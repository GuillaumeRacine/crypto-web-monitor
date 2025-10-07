import { config as dotenvConfig } from "dotenv";
import path from "path";
// Load env with precedence: process.env > .env.local > .env
dotenvConfig({ path: path.join(process.cwd(), ".env.local") });
dotenvConfig({ path: path.join(process.cwd(), ".env") });
import { loadConfig } from "./config.js";
import { CatalogService } from "./services/catalog.js";
import { RecommendService } from "./services/recommend.js";
import { NoopEmbeddings, OpenAIEmbeddings } from "./services/embeddings.js";
import { PostgresCatalog } from "./adapters/fivedb/catalog.postgres.js";
import { QdrantIndex } from "./adapters/fivedb/vector.qdrant.js";
import { Neo4jGraph } from "./adapters/fivedb/graph.neo4j.js";
import http from "http";
import { URL } from "url";
import crypto from "crypto";

async function main() {
  const cfg = loadConfig();
  console.log(`[present-agent] starting in five-db mode`);
  if (!cfg.postgresUrl) throw new Error("POSTGRES_URL is required");
  const catalogImpl = new PostgresCatalog(cfg.postgresUrl);

  const catalog = new CatalogService(catalogImpl);
  const embed = cfg.openaiApiKey
    ? new OpenAIEmbeddings(cfg.embeddingModel || "text-embedding-3-small", cfg.openaiApiKey)
    : new NoopEmbeddings(cfg.modelName ?? "gpt-4o-mini", cfg.vectorDim);
  const vectorIndex = cfg.vectorDbUrl
    ? new QdrantIndex(cfg.vectorDbUrl, "products", cfg.vectorDim, embed, cfg.vectorDbApiKey)
    : undefined;
  const graph = cfg.neo4jUrl && cfg.neo4jUser && cfg.neo4jPassword
    ? new Neo4jGraph(cfg.neo4jUrl, cfg.neo4jUser, cfg.neo4jPassword, cfg.neo4jDatabase)
    : undefined;
  // Initialize recommender with optional Cohere API key for reranking
  const cohereApiKey = process.env.COHERE_API_KEY;
  const pool = catalogImpl.getPool();
  const recommender = new RecommendService(catalog, embed, vectorIndex, graph, cohereApiKey, pool);
  // Optional chat LLM for natural replies
  let chatLlm: any = null;
  try {
    if (cfg.openaiApiKey) {
      const { OpenAIChat } = await import('./services/llm.js');
      chatLlm = new OpenAIChat(cfg.openaiApiKey, cfg.modelName || 'gpt-4o-mini');
    }
  } catch {}

  // Minimal HTTP server with JSON routes
  const port = Number(process.env.PORT || 3001);
  // simple in-memory session id store (sessions only; data persisted in Postgres)
  const sessions = new Map<string, { userId: string }>();
  const convSimple = new Map<string, { id: string; userId: string; messages: { role: string; content: string; ts: number }[] }>();

  function parseCookies(req: http.IncomingMessage) {
    const raw = req.headers["cookie"] || "";
    const map: Record<string, string> = {};
    raw.split(/;\s*/).forEach((p) => {
      const i = p.indexOf("=");
      if (i > 0) map[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1));
    });
    return map;
  }

  async function upsertUser(email: string, name?: string): Promise<{ id: string; email: string; name?: string }> {
    const { default: pg } = await import("pg");
    const client = new pg.Client({ connectionString: cfg.postgresUrl! });
    await client.connect();
    try {
      const id = crypto.randomUUID();
      const res = await client.query(
        `INSERT INTO users(id, email, name) VALUES ($1,$2,$3)
         ON CONFLICT(email) DO UPDATE SET name = COALESCE(EXCLUDED.name, users.name)
         RETURNING id, email, name`,
        [id, email, name || null]
      );
      return res.rows[0];
    } finally {
      await client.end();
    }
  }

  async function getUserById(id: string): Promise<{ id: string; email: string; name?: string } | null> {
    const { default: pg } = await import("pg");
    const client = new pg.Client({ connectionString: cfg.postgresUrl! });
    await client.connect();
    try {
      const res = await client.query(`SELECT id, email, name FROM users WHERE id = $1 LIMIT 1`, [id]);
      return res.rows[0] || null;
    } finally {
      await client.end();
    }
  }

  async function ensureConversation(client: any, userId: string, sessMap: Map<string, any>, sid?: string): Promise<string> {
    // reuse last conversation for this user, else create
    const r = await client.query(`SELECT id FROM conversations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, [userId]);
    if (r.rows.length > 0) return r.rows[0].id;
    const id = crypto.randomUUID();
    await client.query(`INSERT INTO conversations(id, user_id) VALUES ($1,$2)`, [id, userId]);
    return id;
  }

  // Legacy in-memory conversation store retained only for building prompt history when DB logs are unavailable
  const server = http.createServer(async (req, res) => {
    // CORS for local testing (support credentials)
    const origin = (req.headers.origin as string) || "http://localhost:3000";
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const send = (status: number, body: any, headers: Record<string, string> = {}) => {
      res.writeHead(status, { "Content-Type": "application/json", ...headers });
      res.end(JSON.stringify(body));
    };

    try {
      // Auth routes
      if (req.method === "POST" && url.pathname === "/api/auth/signup") {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const bodyText = Buffer.concat(chunks).toString("utf8");
        const body = bodyText ? JSON.parse(bodyText) : {};
        const email = String(body.email || "").trim().toLowerCase();
        const name = body.name ? String(body.name) : undefined;
        if (!email || !email.includes("@")) return send(400, { error: "Invalid email" });
        const user = await upsertUser(email, name);
        const sid = crypto.randomUUID();
        sessions.set(sid, { userId: user.id });
        return send(200, { user }, { "Set-Cookie": `sid=${encodeURIComponent(sid)}; HttpOnly; Path=/; SameSite=Lax` });
      }

      if (req.method === "POST" && url.pathname === "/api/auth/logout") {
        const cookies = parseCookies(req);
        const sid = cookies["sid"]; if (sid) sessions.delete(sid);
        return send(200, { ok: true }, { "Set-Cookie": `sid=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; SameSite=Lax` });
      }

      if (req.method === "GET" && url.pathname === "/api/me") {
        const cookies = parseCookies(req);
        const sid = cookies["sid"]; const sess = sid ? sessions.get(sid) : undefined;
        if (!sess) return send(200, { user: null });
        const user = await getUserById(sess.userId);
        return send(200, { user });
      }
      if (req.method === "GET" && url.pathname === "/api/search") {
        const q = {
          text: url.searchParams.get("text") || undefined,
          budgetMin: url.searchParams.get("budgetMin") ? Number(url.searchParams.get("budgetMin")) : undefined,
          budgetMax: url.searchParams.get("budgetMax") ? Number(url.searchParams.get("budgetMax")) : undefined,
          categories: url.searchParams.getAll("category"),
          limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
          offset: url.searchParams.get("offset") ? Number(url.searchParams.get("offset")) : undefined,
        };
        const items = await catalog.search(q);
        return send(200, { items });
      }

      if (req.method === "GET" && url.pathname === "/api/categories") {
        const cats = await catalog.listCategories();
        return send(200, { items: cats });
      }

      if (req.method === "GET" && url.pathname === "/api/vendors") {
        const { default: pg } = await import("pg");
        const client = new pg.Client({ connectionString: cfg.postgresUrl! });
        await client.connect();
        try {
          const r = await client.query(`SELECT name FROM vendors ORDER BY name ASC`);
          return send(200, { items: r.rows.map((x:any)=>String(x.name)) });
        } finally { await client.end(); }
      }

      if (req.method === "GET" && url.pathname === "/api/facets") {
        const { default: pg } = await import("pg");
        const client = new pg.Client({ connectionString: cfg.postgresUrl! });
        await client.connect();
        try {
          const r = await client.query(`
            SELECT facet_key, facet_value, COUNT(*) as count
            FROM product_facets
            GROUP BY facet_key, facet_value
            ORDER BY facet_key, count DESC
          `);
          // Group by key
          const grouped: Record<string, Array<{value: string; count: number}>> = {};
          for (const row of r.rows) {
            if (!grouped[row.facet_key]) grouped[row.facet_key] = [];
            grouped[row.facet_key].push({ value: row.facet_value, count: Number(row.count) });
          }
          return send(200, grouped);
        } finally { await client.end(); }
      }

      // Admin: list vendor categories and current mappings
      if (req.method === "GET" && url.pathname === "/api/admin/vendor_categories") {
        const vendor = url.searchParams.get('vendor') || '';
        if (!vendor) return send(400, { error: 'vendor required' });
        const { default: pg } = await import("pg");
        const client = new pg.Client({ connectionString: cfg.postgresUrl! });
        await client.connect();
        try {
          const sql = `
            SELECT DISTINCT c.name AS category, m.target_category_id, c2.name AS mapped_to
            FROM products p
            LEFT JOIN vendors v ON v.id = p.vendor_id
            LEFT JOIN categories c ON c.id = p.category_id
            LEFT JOIN category_mappings m ON m.source_vendor = v.name AND m.source_category = c.name
            LEFT JOIN categories c2 ON c2.id = m.target_category_id
            WHERE v.name = $1
            ORDER BY c.name ASC`;
          const r = await client.query(sql, [vendor]);
          return send(200, { items: r.rows.map((x:any)=>({ category: x.category, mappedTo: x.mapped_to || null })) });
        } finally { await client.end(); }
      }

      // Admin: upsert a mapping from vendor+source category to target category name
      if (req.method === "POST" && url.pathname === "/api/admin/mappings") {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const bodyText = Buffer.concat(chunks).toString("utf8");
        const payload = bodyText ? JSON.parse(bodyText) : {};
        const vendor = String(payload.vendor || '').trim();
        const sourceCategory = String(payload.sourceCategory || '').trim();
        const targetCategory = String(payload.targetCategory || '').trim();
        if (!vendor || !sourceCategory || !targetCategory) return send(400, { error: 'vendor, sourceCategory, targetCategory required' });
        const { default: pg } = await import("pg");
        const client = new pg.Client({ connectionString: cfg.postgresUrl! });
        await client.connect();
        try {
          // Ensure target category exists
          const c = await client.query(`INSERT INTO categories(name) VALUES ($1) ON CONFLICT(name) DO UPDATE SET name = EXCLUDED.name RETURNING id`, [targetCategory]);
          const targetId = c.rows[0].id;
          await client.query(
            `INSERT INTO category_mappings(source_vendor, source_category, target_category_id, rule, confidence, updated_by)
             VALUES ($1,$2,$3,$4,$5,$6)
             ON CONFLICT(source_vendor, source_category) DO UPDATE SET target_category_id = EXCLUDED.target_category_id, rule = EXCLUDED.rule, confidence = EXCLUDED.confidence, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
            [vendor, sourceCategory, targetId, payload.rule || 'manual', Number(payload.confidence || 1.0), payload.updatedBy || null]
          );
          return send(200, { ok: true });
        } finally { await client.end(); }
      }

      // Internal auditing: paginated products view with total count
      if (req.method === "GET" && url.pathname === "/api/products_audit") {
        const limitRaw = url.searchParams.get("limit");
        const offsetRaw = url.searchParams.get("offset");
        const text = url.searchParams.get("text") || undefined;
        const category = url.searchParams.get("category") || undefined;
        const vendor = url.searchParams.get("vendor") || undefined;
        const facets = url.searchParams.get("facets") || undefined; // comma-separated key:value pairs
        const limit = Math.min(Math.max(Number(limitRaw || 100), 1), 500);
        const offset = Math.max(Number(offsetRaw || 0), 0);
        const sort = (url.searchParams.get("sort") || "updated").toLowerCase();
        const order = (url.searchParams.get("order") || "desc").toLowerCase() === 'asc' ? 'ASC' : 'DESC';
        const { default: pg } = await import("pg");
        const client = new pg.Client({ connectionString: cfg.postgresUrl! });
        await client.connect();
        try {
          const clauses: string[] = [];
          const params: any[] = [];
          let i = 1;
          if (text) { clauses.push(`(p.title ILIKE $${i} OR p.description ILIKE $${i})`); params.push(`%${text}%`); i++; }
          if (category) { clauses.push(`c.name = $${i}`); params.push(category); i++; }
          if (vendor) { clauses.push(`v.name = $${i}`); params.push(vendor); i++; }

          // Facet filtering: each facet adds an EXISTS clause
          if (facets) {
            const facetPairs = facets.split(',').map(f => f.trim()).filter(Boolean);
            for (const pair of facetPairs) {
              const [key, value] = pair.split(':');
              if (key && value) {
                clauses.push(`EXISTS (SELECT 1 FROM product_facets pf WHERE pf.product_id = p.id AND pf.facet_key = $${i} AND pf.facet_value = $${i+1})`);
                params.push(key, value);
                i += 2;
              }
            }
          }

          const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
          const countSql = `SELECT COUNT(*)::bigint AS total FROM products p LEFT JOIN vendors v ON v.id = p.vendor_id LEFT JOIN categories c ON c.id = p.category_id ${where}`;
          const totalRes = await client.query(countSql, params);
          const total = Number(totalRes.rows?.[0]?.total || 0);
          let orderBy = `p.updated_at ${order}`;
          if (sort === 'id') orderBy = `p.id ${order}`;
          else if (sort === 'title') orderBy = `p.title ${order}`;
          else if (sort === 'vendor') orderBy = `v.name ${order}`;
          else if (sort === 'category') orderBy = `c.name ${order}`;
          else if (sort === 'price') orderBy = `p.price ${order}`;
          else if (sort === 'available') orderBy = `p.available ${order}`;
          else if (sort === 'created') orderBy = `p.created_at ${order}`;

          const dataSql = `
            SELECT p.*, v.name AS vendor_name, c.name AS category_name
            FROM products p
            LEFT JOIN vendors v ON v.id = p.vendor_id
            LEFT JOIN categories c ON c.id = p.category_id
            ${where}
            ORDER BY ${orderBy}
            LIMIT ${limit} OFFSET ${offset}
          `;
          const dataRes = await client.query(dataSql, params);
          const items = dataRes.rows.map((row: any) => ({
            id: String(row.id),
            title: row.title,
            description: row.description || null,
            vendor: row.vendor_name || null,
            category: row.category_name || null,
            price: Number(row.price),
            currency: row.currency || 'USD',
            available: !!row.available,
            imageUrl: row.image_url || null,
            productUrl: row.product_url,
            sourceWebsite: row.source_website || null,
            tags: row.tags || [],
            attributes: row.attributes || {},
            updatedAt: row.updated_at,
            createdAt: row.created_at,
          }));
          return send(200, { items, total, limit, offset });
        } finally {
          await client.end();
        }
      }

      // Admin: list pending category suggestions
      if (req.method === "GET" && url.pathname === "/api/admin/suggestions") {
        const status = url.searchParams.get('status') || 'pending';
        const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 100), 1), 1000);
        const offset = Math.max(Number(url.searchParams.get('offset') || 0), 0);
        const { default: pg } = await import("pg");
        const client = new pg.Client({ connectionString: cfg.postgresUrl! });
        await client.connect();
        try {
          const sql = `
            SELECT cs.id, cs.product_id, cs.suggested_category_id, cs.confidence, cs.status,
                   p.title, c.name AS category_name
            FROM category_suggestions cs
            JOIN products p ON p.id = cs.product_id
            LEFT JOIN categories c ON c.id = cs.suggested_category_id
            WHERE cs.status = $1
            ORDER BY cs.confidence DESC, cs.id ASC
            LIMIT ${limit} OFFSET ${offset}`;
          const r = await client.query(sql, [status]);
          return send(200, { items: r.rows });
        } finally { await client.end(); }
      }

      // Admin: accept or reject a suggestion
      if (req.method === "POST" && url.pathname.startsWith("/api/admin/suggestions/")) {
        const parts = url.pathname.split("/");
        const sugId = Number(parts[parts.length - 1]);
        const action = url.searchParams.get('action') || 'accept';
        const mode = url.searchParams.get('mode') || 'additional'; // 'primary' | 'additional'
        const { default: pg } = await import("pg");
        const client = new pg.Client({ connectionString: cfg.postgresUrl! });
        await client.connect();
        try {
          const s = await client.query(`SELECT product_id, suggested_category_id FROM category_suggestions WHERE id = $1`, [sugId]);
          if (s.rows.length === 0) return send(404, { error: 'Not found' });
          const { product_id, suggested_category_id } = s.rows[0];
          if (action === 'reject') {
            await client.query(`UPDATE category_suggestions SET status = 'rejected' WHERE id = $1`, [sugId]);
            return send(200, { ok: true });
          }
          // accept
          if (mode === 'primary') {
            await client.query(`UPDATE products SET category_id = $1 WHERE id = $2`, [suggested_category_id, product_id]);
          }
          await client.query(
            `INSERT INTO product_categories(product_id, category_id) VALUES ($1,$2)
             ON CONFLICT (product_id, category_id) DO NOTHING`,
             [product_id, suggested_category_id]
          );
          await client.query(`UPDATE category_suggestions SET status = 'accepted' WHERE id = $1`, [sugId]);
          return send(200, { ok: true });
        } finally { await client.end(); }
      }

      // Get current occasion
      if (req.method === "GET" && url.pathname === "/api/occasions/current") {
        try {
          const { getCurrentOccasion, getOccasionMessage } = await import('./services/occasion-detector.js');
          const occasion = getCurrentOccasion();
          const message = getOccasionMessage(occasion);
          return send(200, { occasion, message });
        } catch (e: any) {
          console.error("GET /api/occasions/current error:", e?.message || e);
          return send(500, { error: "occasion fetch failed" });
        }
      }

      // Get trending products
      if (req.method === "GET" && url.pathname === "/api/trending") {
        try {
          const { trendingCache } = await import('./services/trending.js');
          const { default: pg } = await import("pg");
          const pool = new pg.Pool({ connectionString: cfg.postgresUrl! });

          const trendingIds = await trendingCache.getTrendingIds(pool);
          await pool.end();

          return send(200, { trendingIds: Array.from(trendingIds) });
        } catch (e: any) {
          console.error("GET /api/trending error:", e?.message || e);
          return send(500, { error: "trending fetch failed" });
        }
      }

      // Admin: list auto-assigned categories for audit
      if (req.method === "GET" && url.pathname === "/api/admin/auto_categories") {
        const method = url.searchParams.get('method') || 'all'; // 'all' | 'suggestion' | 'vendor_majority' | 'global_top'
        const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 100), 1), 1000);
        const offset = Math.max(Number(url.searchParams.get('offset') || 0), 0);
        const { default: pg } = await import("pg");
        const client = new pg.Client({ connectionString: cfg.postgresUrl! });
        await client.connect();
        try {
          const rows = await client.query(
            `SELECT e.ts, (e.payload->>'productId') AS product_id,
                    p.title, p.image_url, p.product_url,
                    c.name AS category_name,
                    COALESCE(e.payload->>'method','') AS method
             FROM events e
             LEFT JOIN products p ON p.id = (e.payload->>'productId')
             LEFT JOIN categories c ON c.id = p.category_id
             WHERE e.type = 'category_auto_assign'
               AND ($1 = 'all' OR e.payload->>'method' = $1)
             ORDER BY e.ts DESC
             LIMIT ${limit} OFFSET ${offset}`,
            [method]
          );
          return send(200, { items: rows.rows });
        } finally { await client.end(); }
      }

      if (req.method === "GET" && url.pathname.startsWith("/api/products/")) {
        const id = url.pathname.split("/").pop() as string;
        const item = await catalog.getById(id);
        if (!item) return send(404, { error: "Not found" });
        // Fetch facets and suggestions (if any)
        try {
          const { default: pg } = await import("pg");
          const client = new pg.Client({ connectionString: cfg.postgresUrl! });
          await client.connect();
          try {
            const pid = await client.query(`SELECT category_id FROM products WHERE id = $1`, [id]);
            const primaryCategoryId = pid.rows[0]?.category_id || null;
            const f = await client.query(`SELECT facet_key, facet_value, confidence, source FROM product_facets WHERE product_id = $1 ORDER BY facet_key, facet_value`, [id]);
            const facets = f.rows || [];
            const s = await client.query(`SELECT suggested_category_id, confidence, status FROM category_suggestions WHERE product_id = $1 ORDER BY confidence DESC LIMIT 5`, [id]);
            const suggestions = s.rows || [];
            const ac = await client.query(
              `SELECT c.name FROM product_categories pc JOIN categories c ON c.id = pc.category_id
               WHERE pc.product_id = $1 AND ($2::int IS NULL OR pc.category_id <> $2)
               ORDER BY c.name ASC`,
              [id, primaryCategoryId]
            );
            const additionalCategories = ac.rows.map((r:any)=>r.name);
            return send(200, { item, facets, suggestions, additionalCategories });
          } finally { await client.end(); }
        } catch {
          return send(200, { item, facets: [], suggestions: [], additionalCategories: [] });
        }
      }

      // Admin: set or add category for a product
      if (req.method === "POST" && /\/api\/products\/.+\/category$/.test(url.pathname)) {
        const parts = url.pathname.split("/");
        const productId = parts[parts.length - 2];
        const mode = (url.searchParams.get('mode') || 'primary').toLowerCase(); // 'primary' | 'additional'
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const bodyText = Buffer.concat(chunks).toString("utf8");
        const payload = bodyText ? JSON.parse(bodyText) : {};
        const nameRaw = String(payload.category || '').trim();
        if (!nameRaw) return send(400, { error: 'category required' });
        const { default: pg } = await import("pg");
        const client = new pg.Client({ connectionString: cfg.postgresUrl! });
        await client.connect();
        try {
          // Ensure category exists
          const c = await client.query(`INSERT INTO categories(name) VALUES ($1) ON CONFLICT(name) DO UPDATE SET name = EXCLUDED.name RETURNING id, name`, [nameRaw]);
          const catId = c.rows[0].id;
          if (mode === 'primary') {
            await client.query(`UPDATE products SET category_id = $1 WHERE id = $2`, [catId, productId]);
          } else {
            const p = await client.query(`SELECT category_id FROM products WHERE id = $1`, [productId]);
            const hasPrimary = !!p.rows[0]?.category_id;
            if (!hasPrimary) await client.query(`UPDATE products SET category_id = $1 WHERE id = $2`, [catId, productId]);
          }
          await client.query(
            `INSERT INTO product_categories(product_id, category_id) VALUES ($1,$2)
             ON CONFLICT (product_id, category_id) DO NOTHING`,
            [productId, catId]
          );
          return send(200, { ok: true, category: c.rows[0].name });
        } finally { await client.end(); }
      }

      if (req.method === "POST" && url.pathname === "/api/recommend") {
        const startTime = Date.now();
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const bodyText = Buffer.concat(chunks).toString("utf8");
        const body = bodyText ? JSON.parse(bodyText) : {};

        // Fast mode: skip heavy personalization if requested
        const fastMode = body.fastMode === true;

        // Attach user as recipient for graph-based boosts if present
        const cookies = parseCookies(req);
        const sid = cookies["sid"]; const sess = sid ? sessions.get(sid) : undefined;
        if (sess && !body.recipientId) body.recipientId = sess.userId;

        // Get session ID for tracking
        const { getSessionId, sessionStore } = await import('./services/session.js');
        const sessionId = getSessionId(req);
        const sessionContext = sessionStore.getRecommendationContext(sessionId);

        // Merge saved context to enrich query (Postgres only)
        if (sess && !fastMode) {
          try {
            const { default: pg } = await import("pg");
            const client = new pg.Client({ connectionString: cfg.postgresUrl! });
            await client.connect();
            try {
              const r = await client.query(`SELECT data FROM user_context WHERE user_id = $1`, [sess.userId]);
              const data = r.rows[0]?.data || {};
              if (data.budgetMin != null && body.query?.budgetMin == null) body.query.budgetMin = data.budgetMin;
              if (data.budgetMax != null && body.query?.budgetMax == null) body.query.budgetMax = data.budgetMax;
              if (Array.isArray(data.categories) && (!body.query?.categories || body.query.categories.length === 0)) body.query.categories = data.categories;
              if (typeof data.notes === 'string' && body.query?.text) body.query.text = `${body.query.text} ${data.notes}`.slice(0, 1000);
            } finally { await client.end(); }
          } catch {}
        }

        // Apply session-based context (price range, category boost, exclude abandoned)
        if (!body.query) body.query = {};
        if (sessionContext.priceRange) {
          if (!body.query.budgetMin) body.query.budgetMin = sessionContext.priceRange.min;
          if (!body.query.budgetMax) body.query.budgetMax = sessionContext.priceRange.max;
        }
        if (sessionContext.categoryBoost && sessionContext.categoryBoost.length > 0) {
          // Add inferred categories if user hasn't specified any
          if (!body.query.categories || body.query.categories.length === 0) {
            body.query.categories = sessionContext.categoryBoost;
          }
        }
        // Pass exclude IDs to filter out abandoned products
        if (sessionContext.excludeIds && sessionContext.excludeIds.length > 0) {
          body.excludeIds = sessionContext.excludeIds;
        }

        // Performance tracking
        const contextTime = Date.now() - startTime;

        const result = await recommender.recommend(body);

        // Filter out excluded products from results
        if (body.excludeIds && body.excludeIds.length > 0) {
          const excludeSet = new Set(body.excludeIds);
          result.items = result.items.filter(item => !excludeSet.has(item.product.id));
        }

        // Add performance metrics
        result.performanceMetrics = {
          contextLoadMs: contextTime,
          recommendationMs: result.tookMs,
          totalMs: Date.now() - startTime,
        };

        // Log assistant summary message
        if (sess) {
          try {
            const summary = `Recommended ${result.items.length} items for your query.`;
            const { default: pg } = await import("pg");
            const client = new pg.Client({ connectionString: cfg.postgresUrl! });
            await client.connect();
            try {
              const convId = await ensureConversation(client, sess.userId, sessions, sid);
              await client.query(`INSERT INTO messages(conversation_id, role, content) VALUES ($1,$2,$3)`, [convId, 'assistant', summary]);
            } finally { await client.end(); }
          } catch {}
        }
        return send(200, result);
      }

      if (req.method === "POST" && url.pathname === "/api/chat") {
        // Conversational orchestrator: save natural input, ask for missing details, or recommend.
        const cookies = parseCookies(req);
        const sid = cookies["sid"]; const sess = sid ? sessions.get(sid) : undefined;
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const bodyText = Buffer.concat(chunks).toString("utf8");
        const payload = bodyText ? JSON.parse(bodyText) : {};
        const text: string = String(payload.message || "");
        if (!text) return send(400, { error: "message required" });

        // Log user turn (Postgres conversation)
        try {
          if (sess) {
            const { default: pg } = await import("pg");
            const client = new pg.Client({ connectionString: cfg.postgresUrl! });
            await client.connect();
            try {
              const convId = await ensureConversation(client, sess.userId, sessions, sid);
              await client.query(`INSERT INTO messages(conversation_id, role, content) VALUES ($1,$2,$3)`, [convId, 'user', text]);
            } finally { await client.end(); }
          }
        } catch {}

        // Extract budgets/recipient and save context
        let budgetMin: number | undefined; let budgetMax: number | undefined; let recipientKey: string | undefined;
        const parseBudget = (s: string) => {
          // Pattern 1: "between X and Y"
          const between = s.match(/\bbetween\s*\$?(\d{1,5})\s*(and|-|to)\s*\$?(\d{1,5})\b/i);
          if (between) return { min: Math.min(+between[1], +between[3]), max: Math.max(+between[1], +between[3]) };

          // Pattern 2: "X-Y" or "X–Y" (range)
          const range = s.match(/\b\$?(\d{1,5})\s*[-–]\s*\$?(\d{1,5})\b/);
          if (range) return { min: Math.min(+range[1], +range[2]), max: Math.max(+range[1], +range[2]) };

          // Pattern 3: "under/below/up to $X"
          const under = s.match(/\b(under|below|less than|up to|max(?:imum)?|at most)\s*\$?(\d{1,5})\b/i);
          if (under) return { max: +under[2] } as any;

          // Pattern 4: "around/about $X" (NEW: wider range ±20%)
          const around = s.match(/\b(about|around|roughly|approx(?:\.|imate(?:ly)?)?)\s*\$?(\d{1,5})\b/i);
          if (around) {
            const val = +around[2];
            return { min: Math.floor(val * 0.8), max: Math.ceil(val * 1.2) } as any;
          }

          // Pattern 5: "budget is/of $X" or "budget $X"
          const stated = s.match(/\b(budget\s*(?:is|of|:|around)?)\s*\$?(\d{1,5})\b/i);
          if (stated) return { max: +stated[2] } as any;

          // Pattern 6: "spend/for $X"
          const spend = s.match(/\b(spend|for)\s*\$?(\d{1,5})\b/i);
          if (spend) return { max: +spend[2] } as any;

          // Pattern 7: "only have $X" (NEW)
          const onlyHave = s.match(/\b(only have|just have|got)\s*\$?(\d{1,5})\b/i);
          if (onlyHave) return { max: +onlyHave[2] } as any;

          // Pattern 8: "X dollars" without "$"
          const dollars = s.match(/\b(\d{2,4})\s*dollars?\b/i);
          if (dollars) return { max: +dollars[1] } as any;

          // Pattern 9: "$X" standalone (must be 2-4 digits)
          const standalone = s.match(/\$(\d{2,4})\b/);
          if (standalone) return { max: +standalone[1] } as any;

          return {} as any;
        };
        // Detect emotional context and milestones FIRST
        let emotionalContext: any = {};
        let milestoneMessage: string | null = null;
        let extractedData: any = {};
        try {
          const { extractFromText, extractRecipient, extractOccasion, detectEmotionalContext, celebrateMilestone, buildEmpatheticIntro } = await import('./services/extract.js');

          // Detect emotions and milestones
          emotionalContext = detectEmotionalContext(text);
          milestoneMessage = celebrateMilestone(text);

          recipientKey = extractRecipient(text);
          const occasion = extractOccasion(text);
          const ex = await extractFromText(text, catalogImpl as any);
          const b = parseBudget(text);
          // Only assign if values are actually defined
          if (b.min != null) budgetMin = b.min;
          if (b.max != null) budgetMax = b.max;

          // Build extracted data object for current request
          extractedData = {
            budgetMin,
            budgetMax,
            categories: ex.categories || [],
            values: ex.values || [],
            interests: ex.interests || [],
            occasion,
            recipientKey
          };

          if (process.env.LOG_LEVEL === 'debug') {
            console.debug('[chat] extracted', { recipientKey, occasion, budgetMin, budgetMax, values: ex.values, categories: ex.categories, interests: ex.interests, emotional: emotionalContext });
          }
          // Save context (notes + budgets + extracted signals)
          const ctxPayload: any = { notes: text };
          if (budgetMin != null) ctxPayload.budgetMin = budgetMin;
          if (budgetMax != null) ctxPayload.budgetMax = budgetMax;
          if (ex.categories?.length) ctxPayload.categories = ex.categories;
          if (ex.values?.length) ctxPayload.values = ex.values;
          if (ex.interests?.length) ctxPayload.interests = ex.interests;
          if (occasion) ctxPayload.occasion = occasion;
          if (recipientKey) ctxPayload.recipientKey = recipientKey;
          // Reuse the same save code path
          req.method = "POST"; // no-op
          // direct write to Postgres
          if (sess) {
            const { default: pg } = await import("pg");
            const client = new pg.Client({ connectionString: cfg.postgresUrl! });
            await client.connect();
            try {
              if (ctxPayload.recipientKey) {
                await client.query(`INSERT INTO recipient_context(user_id, recipient_key, data) VALUES ($1,$2,$3) ON CONFLICT(user_id, recipient_key) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`, [sess.userId, ctxPayload.recipientKey, ctxPayload]);
              } else {
                await client.query(`INSERT INTO user_context(user_id, data) VALUES ($1,$2) ON CONFLICT(user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`, [sess.userId, ctxPayload]);
              }
            } finally { await client.end(); }
            // Neo4j upsert
            if (graph && (ctxPayload.categories || ctxPayload.vendors || ctxPayload.values)) {
              const rid = ctxPayload.recipientKey ? `${sess.userId}:${ctxPayload.recipientKey}` : sess.userId;
              await graph.upsertRelationshipGraph({ recipientId: rid, likes: { categories: ctxPayload.categories, vendors: ctxPayload.vendors, values: ctxPayload.values } });
            }
          }
        } catch {}

        // Load merged context (recipient first), then merge with current extraction
        let merged: any = {};
        if (sess) {
          const { default: pg } = await import("pg");
          const client = new pg.Client({ connectionString: cfg.postgresUrl! });
          await client.connect();
          try {
            if (recipientKey) {
              const r = await client.query(`SELECT data FROM recipient_context WHERE user_id = $1 AND recipient_key = $2`, [sess.userId, recipientKey]);
              merged = r.rows[0]?.data || {};
            }
            if (!merged || Object.keys(merged).length === 0) {
              const u = await client.query(`SELECT data FROM user_context WHERE user_id = $1`, [sess.userId]);
              merged = u.rows[0]?.data || {};
            }
          } finally { await client.end(); }
        }

        // Merge extracted data from current request (current request takes priority)
        merged = {
          ...merged,
          ...extractedData,
          // Merge arrays instead of replacing
          categories: [...(extractedData.categories || []), ...(merged.categories || [])].slice(0, 8),
          values: [...(extractedData.values || []), ...(merged.values || [])],
          interests: [...(extractedData.interests || []), ...(merged.interests || [])]
        };

        if (process.env.LOG_LEVEL === 'debug') {
          console.debug('[chat] merged context (after merging extracted)', merged);
        }

        // Decide readiness: require meaningful context, not just budget
        // Need at least 2 of: [budget, recipient, interests/categories, occasion]
        const occasionSignal = /birthday|anniversary|wedding|holiday|valentine|thank|graduation|baby|diwali|christmas|hanukkah|eid/i.test(text);
        const hasBudget = merged.budgetMin != null || merged.budgetMax != null;
        const hasRecipient = !!recipientKey;
        const hasInterests = (merged.categories?.length > 0) || (merged.interests?.length > 0) || (merged.values?.length > 0);
        const hasOccasion = occasionSignal || !!merged.occasion;

        // Count how many context signals we have
        const contextSignals = [hasBudget, hasRecipient, hasInterests, hasOccasion].filter(Boolean).length;

        // Require at least 2 signals to proceed (prevents showing products for "budget $50" alone)
        const ready = contextSignals >= 2;

        const contextSummary = (() => {
          const parts: string[] = [];
          if (recipientKey) parts.push(`recipient: ${recipientKey}`);
          if (merged.budgetMin != null || merged.budgetMax != null) parts.push(`budget: ${merged.budgetMin ?? '—'}–${merged.budgetMax ?? '—'}`);
          if (Array.isArray(merged.values) && merged.values.length) parts.push(`values: ${merged.values.join(', ')}`);
          if (Array.isArray(merged.categories) && merged.categories.length) parts.push(`categories: ${merged.categories.slice(0,4).join(', ')}`);
          return parts.length ? `Using your context (${parts.join('; ')}). I’ll remember this. You can manage it in Memory.` : '';
        })();

        if (!ready) {
          let prompt: string;
          const needBudget = !hasBudget;
          const needRecipient = !hasRecipient;
          const needInterests = !hasInterests;
          const needOccasion = !hasOccasion;

          const missing: string[] = [];
          if (needBudget) missing.push('budget');
          if (needRecipient) missing.push('recipient');
          if (needInterests && !hasRecipient) missing.push('interests or hobbies');
          if (needOccasion && !hasRecipient && !hasInterests) missing.push('occasion');

          // Build empathetic response with variety
          let fallback: string;
          const { buildEmpatheticIntro } = await import('./services/extract.js');
          const empatheticIntro = buildEmpatheticIntro(emotionalContext);

          // Add milestone celebration if detected
          let prefix = '';
          if (milestoneMessage) {
            prefix = milestoneMessage + ' ';
          } else if (empatheticIntro) {
            prefix = empatheticIntro + ' ';
          }

          // Varied acknowledgments when we have partial info
          const acknowledgments = recipientKey
            ? ["Got it", "Nice", "Perfect", "Love that", "Okay"].map(a => `${a}—shopping for your ${recipientKey}! `)
            : empatheticIntro || milestoneMessage
            ? ['']
            : ["Absolutely", "Sure thing", "I'd love to help", "Let's do it"].map(a => `${a}! `);
          const ack = acknowledgments[Math.floor(Math.random() * acknowledgments.length)];

          // Build contextual follow-up questions
          if (contextSignals === 0) {
            // No context at all - ask for everything
            const questions = [
              "Who's the gift for, and what budget are you thinking?",
              "Tell me about the person and your budget?",
              "Who's this for, what's the occasion, and what's your price range?"
            ];
            fallback = prefix + ack + questions[Math.floor(Math.random() * questions.length)];
          } else if (contextSignals === 1) {
            // Have 1 signal, need 1 more - be specific about what's missing
            if (hasBudget && !hasRecipient && !hasInterests) {
              // Only have budget
              const questions = [
                "Got the budget! Who's the gift for? What are they into?",
                "Perfect! Now tell me about the person—what do they love?",
                "Great! Who's this for, and what are their interests?"
              ];
              fallback = prefix + questions[Math.floor(Math.random() * questions.length)];
            } else if (hasRecipient && !hasBudget) {
              // Only have recipient
              const questions = [
                `Got it—shopping for your ${recipientKey}! What's your budget, and what are they interested in?`,
                `Perfect! What's your price range, and what does your ${recipientKey} enjoy?`
              ];
              fallback = prefix + questions[Math.floor(Math.random() * questions.length)];
            } else if (hasInterests && !hasRecipient && !hasBudget) {
              // Only have interests/categories
              const questions = [
                "Nice! Who's the gift for, and what's your budget?",
                "Got it! Who's this for, and what price range?"
              ];
              fallback = prefix + questions[Math.floor(Math.random() * questions.length)];
            } else if (hasOccasion && !hasRecipient && !hasBudget) {
              // Only have occasion
              const questions = [
                "Perfect! Who's the gift for, and what's your budget?",
                "Great! Tell me about the person and your price range?"
              ];
              fallback = prefix + questions[Math.floor(Math.random() * questions.length)];
            } else {
              fallback = prefix + "Could you share a bit more detail so I can find the perfect match?";
            }
          } else {
            // Shouldn't reach here since contextSignals >= 2 means ready=true
            fallback = prefix + "Let me find some great options for you!";
          }
          if (chatLlm) {
      const { systemPrompt, buildContextBlock, buildHistoryBlock } = await import('./services/prompts/chat.js');
            const system = systemPrompt();
            const ctxBlock = buildContextBlock({ ...merged, recipientKey });
            const hist = buildHistoryBlock(sess ? (convSimple.get(sess.userId)?.messages || []) : []);
            const u = `Context:\n${ctxBlock}\n${hist}\n\nUser: ${text}\nMissing: ${missing.join(', ')}`;
            try {
              prompt = await chatLlm.chat([{ role: 'system', content: system }, { role: 'user', content: u }]);
            } catch { prompt = fallback; }
          } else {
            prompt = fallback;
          }
          // log assistant to Postgres if possible
          if (sess) {
            try {
              const { default: pg } = await import("pg");
              const client = new pg.Client({ connectionString: cfg.postgresUrl! });
              await client.connect();
              const convId = await ensureConversation(client, sess.userId, sessions, sid);
              await client.query(`INSERT INTO messages(conversation_id, role, content) VALUES ($1,$2,$3)`, [convId, 'assistant', prompt]);
              await client.end();
            } catch {}
          }
          const replyOut: any = { reply: prompt };
          if (contextSummary) replyOut.contextSummary = contextSummary;
          return send(200, replyOut);
        }

        // Build search text from interests/categories instead of full user message
        // This avoids false negatives in full-text search when facets are already filtering
        const { buildRecipientSearchHints, filterInappropriateProducts } = await import('./services/extract.js');
        const searchTerms = [];
        if (merged.interests && merged.interests.length > 0) {
          searchTerms.push(...merged.interests);
        }
        if (merged.categories && merged.categories.length > 0) {
          // Add first category as search term
          searchTerms.push(merged.categories[0].toLowerCase());
        }
        const enhancedText = searchTerms.length > 0 ? searchTerms.join(' ') : text;

        // Build facet query from extracted context
        const facetQuery: any = {};
        if (merged.occasion) facetQuery.occasion = merged.occasion;
        if (recipientKey) {
          // Map recipient to facet recipient values (support multiple patterns)
          const recipientFacetMap: Record<string, string[]> = {
            sister: ['for_her', 'her'],
            mother: ['for_her', 'her', 'mom'],
            wife: ['for_her', 'her'],
            daughter: ['for_her', 'her'],
            aunt: ['for_her', 'her'],
            grandma: ['for_her', 'her'],
            brother: ['for_him', 'him'],
            father: ['for_him', 'him', 'dad'],
            husband: ['for_him', 'him'],
            son: ['for_him', 'him'],
            uncle: ['for_him', 'him'],
            grandpa: ['for_him', 'him'],
            child: ['for_kids', 'kids'],
            nephew: ['for_kids', 'kids'],
            niece: ['for_kids', 'kids'],
            partner: ['for_couples', 'partner'],
            colleague: ['colleague'],
            friend: ['friend'],
          };
          facetQuery.recipients = recipientFacetMap[recipientKey] || [recipientKey];
        }
        if (merged.interests && merged.interests.length > 0) facetQuery.interests = merged.interests;
        if (merged.values && merged.values.length > 0) facetQuery.values = merged.values;

        // Request more items initially so we have enough after filtering
        const query: any = {
          text: enhancedText,
          budgetMin: merged.budgetMin,
          budgetMax: merged.budgetMax,
          categories: merged.categories,
          interests: merged.interests,
          facets: facetQuery,
          limit: 15
        };
        const recBody: any = { query, occasion: merged.occasion, interests: merged.interests };
        if (sess) recBody.recipientId = recipientKey ? `${sess.userId}:${recipientKey}` : sess.userId;
        const result = await recommender.recommend(recBody);

        // Filter out inappropriate items based on recipient type
        let filtered = filterInappropriateProducts(result.items, recipientKey);

        // Quality-based filtering: only show recommendations above a score threshold
        // If we have high-quality matches (score > 0.7), only show those
        // Otherwise show up to 5 best matches, but minimum 3 if available
        const highQuality = filtered.filter(item => item.score > 0.7);
        const mediumQuality = filtered.filter(item => item.score > 0.5 && item.score <= 0.7);

        if (highQuality.length >= 3) {
          // Great matches - show only high quality, max 5
          filtered = highQuality.slice(0, 5);
        } else if (highQuality.length + mediumQuality.length >= 3) {
          // Mix of quality - show high + some medium, max 5
          filtered = [...highQuality, ...mediumQuality].slice(0, 5);
        } else {
          // Limited matches - show what we have, max 5
          filtered = filtered.slice(0, 5);
        }

        result.items = filtered;

        // Track recommendation quality for message customization
        const avgScore = filtered.length > 0
          ? filtered.reduce((sum, item) => sum + item.score, 0) / filtered.length
          : 0;
        const hasStrongMatches = avgScore > 0.7;
        const hasLimitedResults = filtered.length < 3;

        // Build varied, emotionally aware intro
        const { buildEmpatheticIntro } = await import('./services/extract.js');
        const empatheticIntro = buildEmpatheticIntro(emotionalContext);

        let reply = '';

        // Add milestone or emotional response first
        if (milestoneMessage) {
          reply = milestoneMessage + ' ';
        } else if (empatheticIntro) {
          reply = empatheticIntro + ' ';
        }

        // Varied acknowledgment patterns
        if (recipientKey) {
          const acks = [
            `Got it—shopping for your ${recipientKey}`,
            `Perfect, something for your ${recipientKey}`,
            `Okay, gift for your ${recipientKey}`,
            `Nice, your ${recipientKey}`,
            `Love that—your ${recipientKey}`
          ];
          reply += acks[Math.floor(Math.random() * acks.length)] + '. ';
        }

        // Varied recommendation intros based on match quality
        let intros: string[];
        if (hasStrongMatches) {
          intros = [
            "Here are some ideas I think they'll love:",
            "I found some great matches:",
            "Check out these strong matches:",
            "I've got some excellent options for you:",
            "Here are my top picks:"
          ];
        } else if (hasLimitedResults) {
          intros = [
            "I found a few options that might work:",
            "Here are some possibilities:",
            "I have a couple ideas—want me to refine the search?",
            "Here's what I found so far:"
          ];
        } else {
          intros = [
            "Here are some ideas:",
            "I found a few things that caught my eye:",
            "Check these out:",
            "Here's what I'm thinking:",
            "Let me show you a few options:"
          ];
        }

        reply += intros[Math.floor(Math.random() * intros.length)];

        // Use LLM for more natural transition if available
        if (chatLlm) {
          const { systemPrompt, buildContextBlock, buildHistoryBlock } = await import('./services/prompts/chat.js');
          const system = systemPrompt();
          const ctxBlock = buildContextBlock({ ...merged, recipientKey });
          const hist = buildHistoryBlock(sess ? (convSimple.get(sess.userId)?.messages || []) : []);
          const u = `Context:\n${ctxBlock}\n${hist}\n\nUser: ${text}\nAssistant task: Write a brief (1 sentence), warm transition into showing recommendations. Match any emotional tone (excited, urgent, thoughtful).`;
          try {
            const llmReply = await chatLlm.chat([{ role: 'system', content: system }, { role: 'user', content: u }], 0.3);
            // Use LLM reply if it's reasonable length
            if (llmReply.length < 200) {
              reply = llmReply;
            }
          } catch {}
        }

        if (sess) {
          try {
            const { default: pg } = await import("pg");
            const client = new pg.Client({ connectionString: cfg.postgresUrl! });
            await client.connect();
            const convId = await ensureConversation(client, sess.userId, sessions, sid);
            await client.query(`INSERT INTO messages(conversation_id, role, content) VALUES ($1,$2,$3)`, [convId, 'assistant', reply]);
            await client.end();
          } catch {}
        }
        const out: any = { reply, items: result.items };
        if (contextSummary) out.contextSummary = contextSummary;
        return send(200, out);
      }

      if (req.method === "POST" && url.pathname === "/api/graph/preferences") {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const bodyText = Buffer.concat(chunks).toString("utf8");
        const body = bodyText ? JSON.parse(bodyText) : {};
        if (!graph) return send(501, { error: "Graph adapter not configured" });
        await graph.upsertRelationshipGraph(body);
        return send(200, { ok: true });
      }

      if (req.method === "POST" && url.pathname === "/api/chat/log") {
        const cookies = parseCookies(req);
        const sid = cookies["sid"]; const sess = sid ? sessions.get(sid) : undefined;
        if (!sess) return send(401, { error: "Not signed in" });
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const bodyText = Buffer.concat(chunks).toString("utf8");
        const payload = bodyText ? JSON.parse(bodyText) : {};
        const role = payload.role || 'user';
        const content = String(payload.content || '');
        try {
          const { default: pg } = await import("pg");
          const client = new pg.Client({ connectionString: cfg.postgresUrl! });
          await client.connect();
          try {
            const convId = await ensureConversation(client, sess.userId, sessions, sid);
            await client.query(`INSERT INTO messages(conversation_id, role, content) VALUES ($1,$2,$3)`, [convId, role, content]);
          } finally { await client.end(); }
          return send(200, { ok: true });
        } catch (e: any) {
          console.error("/api/chat/log error:", e?.message || e);
          return send(500, { error: "log failed" });
        }
      }

      if (req.method === "GET" && url.pathname === "/api/history") {
        const cookies = parseCookies(req);
        const sid = cookies["sid"]; const sess = sid ? sessions.get(sid) : undefined;
        if (!sess) return send(200, { items: [] });
        const { default: pg } = await import("pg");
        const client = new pg.Client({ connectionString: cfg.postgresUrl! });
        await client.connect();
        try {
          const c = await client.query(`SELECT id FROM conversations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, [sess.userId]);
          if (c.rows.length === 0) return send(200, { items: [] });
          const convId = c.rows[0].id;
          const m = await client.query(`SELECT role, content, created_at FROM messages WHERE conversation_id = $1 ORDER BY id ASC LIMIT 100`, [convId]);
          return send(200, { items: m.rows });
        } finally { await client.end(); }
      }
      if (req.method === "GET" && url.pathname === "/api/recipients") {
        const cookies = parseCookies(req);
        const sid = cookies["sid"]; const sess = sid ? sessions.get(sid) : undefined;
        if (!sess) return send(200, { items: [] });
        const { default: pg2 } = await import("pg");
        const client2 = new pg2.Client({ connectionString: cfg.postgresUrl! });
        await client2.connect();
        try {
          const r = await client2.query(`SELECT recipient_key FROM recipient_context WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 50`, [sess.userId]);
          return send(200, { items: r.rows.map((x:any)=>x.recipient_key) });
        } finally { await client2.end(); }
      }
      if (req.method === "POST" && url.pathname === "/api/context") {
        const cookies = parseCookies(req);
        const sid = cookies["sid"]; const sess = sid ? sessions.get(sid) : undefined;
        if (!sess) return send(401, { error: "Not signed in" });
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const bodyText = Buffer.concat(chunks).toString("utf8");
        const payload = bodyText ? JSON.parse(bodyText) : {};
        // Auto-extract categories/values from notes if absent
        if (typeof payload.notes === 'string') {
          try {
            const { extractFromText } = await import('./services/extract.js');
            const ex = await extractFromText(payload.notes, catalogImpl as any);
            if ((!payload.categories || payload.categories.length === 0) && ex.categories) payload.categories = ex.categories;
            if ((!payload.values || payload.values.length === 0) && ex.values) payload.values = ex.values;
          } catch {}
        }
        try {
          const { default: pg3 } = await import("pg");
          const client3 = new pg3.Client({ connectionString: cfg.postgresUrl! });
          await client3.connect();
          try {
            await client3.query(
              `INSERT INTO user_context(user_id, data) VALUES ($1,$2)
               ON CONFLICT(user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
              [sess.userId, payload]
            );
          } finally {
            await client3.end();
          }
          // Upsert to graph if categories/vendors/values provided
          if (graph && (payload.categories || payload.vendors || payload.values)) {
            const recipientId = payload.recipientKey ? `${sess.userId}:${payload.recipientKey}` : sess.userId;
            await graph.upsertRelationshipGraph({ recipientId, likes: { categories: payload.categories, vendors: payload.vendors, values: payload.values } });
          }
          return send(200, { ok: true });
        } catch (e: any) {
          console.error("/api/context error:", e?.message || e);
          return send(500, { error: "context failed" });
        }
      }

      if (req.method === "DELETE" && url.pathname === "/api/context") {
        const cookies = parseCookies(req);
        const sid = cookies["sid"]; const sess = sid ? sessions.get(sid) : undefined;
        if (!sess) return send(401, { error: "Not signed in" });
        try {
          const { default: pg } = await import("pg");
          const client = new pg.Client({ connectionString: cfg.postgresUrl! });
          await client.connect();
          try {
            const recipientKey = url.searchParams.get('recipient');
            if (recipientKey) {
              await client.query(`DELETE FROM recipient_context WHERE user_id = $1 AND recipient_key = $2`, [sess.userId, recipientKey]);
            } else {
              await client.query(`DELETE FROM user_context WHERE user_id = $1`, [sess.userId]);
            }
            await client.query(`INSERT INTO events(type, payload) VALUES ($1,$2)`, ["context_deleted", { userId: sess.userId }]);
          } finally { await client.end(); }
          return send(200, { ok: true });
        } catch (e: any) {
          console.error("DELETE /api/context error:", e?.message || e);
          return send(500, { error: "delete failed" });
        }
      }

      if (req.method === "GET" && url.pathname === "/api/context") {
        const cookies = parseCookies(req);
        const sid = cookies["sid"]; const sess = sid ? sessions.get(sid) : undefined;
        if (!sess) return send(200, { data: null });
        const recipientKey = url.searchParams.get('recipient') || undefined;
        const { default: pg } = await import("pg");
        const client = new pg.Client({ connectionString: cfg.postgresUrl! });
        await client.connect();
        try {
          if (recipientKey) {
            const r = await client.query(`SELECT data FROM recipient_context WHERE user_id = $1 AND recipient_key = $2`, [sess.userId, recipientKey]);
            return send(200, { data: r.rows[0]?.data || null });
          } else {
            const r = await client.query(`SELECT data FROM user_context WHERE user_id = $1`, [sess.userId]);
            return send(200, { data: r.rows[0]?.data || null });
          }
        } finally { await client.end(); }
      }

      if (req.method === "POST" && url.pathname === "/api/ingest") {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const bodyText = Buffer.concat(chunks).toString("utf8");
        const body = bodyText ? JSON.parse(bodyText) : {};
        const products = Array.isArray(body?.products) ? body.products : [];
        const count = await catalog.ingest(products);
        return send(200, { ingested: count });
      }

      if (req.method === "POST" && url.pathname === "/api/track/view") {
        // Track product view for session-based recommendations
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const bodyText = Buffer.concat(chunks).toString("utf8");
        const body = bodyText ? JSON.parse(bodyText) : {};
        const productId = body.productId;

        if (!productId) return send(400, { error: "productId required" });

        try {
          const { getSessionId, trackProductView } = await import('./services/session.js');
          const sessionId = getSessionId(req);
          await trackProductView(sessionId, productId, catalog);

          // Also log to events table
          const { default: pg } = await import("pg");
          const client = new pg.Client({ connectionString: cfg.postgresUrl! });
          await client.connect();
          try {
            await client.query(`INSERT INTO events(type, payload) VALUES ($1, $2)`, [
              'product_view',
              { product_id: productId, session_id: sessionId }
            ]);
          } finally { await client.end(); }

          return send(200, { ok: true });
        } catch (e: any) {
          console.error("Track view error:", e?.message || e);
          return send(500, { error: "tracking failed" });
        }
      }

      if (req.method === "POST" && url.pathname === "/api/track/click") {
        // Track product click for session-based recommendations
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const bodyText = Buffer.concat(chunks).toString("utf8");
        const body = bodyText ? JSON.parse(bodyText) : {};
        const productId = body.productId;

        if (!productId) return send(400, { error: "productId required" });

        try {
          const { getSessionId, trackProductClick } = await import('./services/session.js');
          const sessionId = getSessionId(req);
          await trackProductClick(sessionId, productId, catalog);

          // Also log to events table
          const { default: pg } = await import("pg");
          const client = new pg.Client({ connectionString: cfg.postgresUrl! });
          await client.connect();
          try {
            await client.query(`INSERT INTO events(type, payload) VALUES ($1, $2)`, [
              'product_click',
              { product_id: productId, session_id: sessionId }
            ]);
          } finally { await client.end(); }

          return send(200, { ok: true });
        } catch (e: any) {
          console.error("Track click error:", e?.message || e);
          return send(500, { error: "tracking failed" });
        }
      }

      if (req.method === "POST" && url.pathname === "/api/purchases") {
        // Record a purchase
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const bodyText = Buffer.concat(chunks).toString("utf8");
        const body = bodyText ? JSON.parse(bodyText) : {};

        const cookies = parseCookies(req);
        const sid = cookies["sid"];
        const sess = sid ? sessions.get(sid) : undefined;

        if (!sess) return send(401, { error: "unauthorized" });

        const { productId, amount, recipientKey, occasion } = body;

        if (!productId || !amount) {
          return send(400, { error: "productId and amount required" });
        }

        try {
          const { recordPurchase } = await import('./services/purchase-history.js');
          const { default: pg } = await import("pg");
          const pool = new pg.Pool({ connectionString: cfg.postgresUrl! });

          const purchaseId = await recordPurchase(
            sess.userId,
            productId,
            parseFloat(amount),
            pool,
            recipientKey,
            occasion
          );

          await pool.end();

          return send(200, { ok: true, purchaseId });
        } catch (e: any) {
          console.error("POST /api/purchases error:", e?.message || e);
          return send(500, { error: "purchase recording failed" });
        }
      }

      if (req.method === "POST" && url.pathname === "/api/feedback") {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const bodyText = Buffer.concat(chunks).toString("utf8");
        const body = bodyText ? JSON.parse(bodyText) : {};

        try {
          const { default: pg } = await import("pg");
          const client = new pg.Client({ connectionString: cfg.postgresUrl! });
          await client.connect();
          try {
            const fbRes = await client.query(
              `INSERT INTO feedback(user_id, recipient_id, product_id, rating, comment)
               VALUES ($1,$2,$3,$4,$5)
               RETURNING id, created_at`,
              [body.userId || null, body.recipientId || null, body.productId || null, Number(body.rating) || 0, body.comment || null]
            );
            await client.query(
              `INSERT INTO events(type, payload) VALUES ($1, $2)`,
              ["feedback", body]
            );
            await client.end();
            return send(200, { ok: true, id: fbRes.rows?.[0]?.id });
          } catch (e) {
            await client.end();
            throw e;
          }
        } catch (e: any) {
          console.error("/api/feedback error:", e?.message || e);
          return send(500, { ok: false, error: e?.message || "feedback failed" });
        }
      }

      // A/B Testing Endpoints
      if (req.method === "POST" && url.pathname === "/api/experiments") {
        // Create a new experiment
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const bodyText = Buffer.concat(chunks).toString("utf8");
        const body = bodyText ? JSON.parse(bodyText) : {};

        try {
          const { default: pg } = await import("pg");
          const { Pool } = pg;
          const pool = new Pool({ connectionString: cfg.postgresUrl });
          const { createExperiment } = await import('./services/ab-testing.js');

          console.log('[AB Testing] Creating experiment:', body.name, 'with variants:', JSON.stringify(body.variants));

          const experiment = await createExperiment(
            body.name,
            body.variants,
            pool,
            body.endDate ? new Date(body.endDate) : undefined
          );

          await pool.end();
          return send(200, experiment);
        } catch (e: any) {
          console.error("POST /api/experiments error:", e?.message || e, e?.stack);
          return send(500, { error: "experiment creation failed", detail: e?.message });
        }
      }

      if (req.method === "GET" && url.pathname.startsWith("/api/experiments/")) {
        // Get experiment results
        const experimentId = url.pathname.split("/").pop();
        if (!experimentId) return send(400, { error: "experiment ID required" });

        try {
          const { default: pg } = await import("pg");
          const { Pool } = pg;
          const pool = new Pool({ connectionString: cfg.postgresUrl });
          const { getExperimentResults } = await import('./services/ab-testing.js');

          const results = await getExperimentResults(experimentId, pool);

          // Convert Map to object for JSON serialization
          const statsObj: Record<string, any> = {};
          for (const [key, value] of results.stats.entries()) {
            statsObj[key] = value;
          }

          await pool.end();
          return send(200, { stats: statsObj, winner: results.winner, confidence: results.confidence });
        } catch (e: any) {
          console.error("GET /api/experiments/:id error:", e?.message || e);
          return send(500, { error: "failed to get experiment results" });
        }
      }

      if (req.method === "POST" && url.pathname === "/api/ab/impression") {
        // Record A/B test impression
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const bodyText = Buffer.concat(chunks).toString("utf8");
        const body = bodyText ? JSON.parse(bodyText) : {};

        try {
          const { default: pg } = await import("pg");
          const { Pool } = pg;
          const pool = new Pool({ connectionString: cfg.postgresUrl });
          const { recordImpression } = await import('./services/ab-testing.js');

          await recordImpression(
            body.experimentId,
            body.variantId,
            body.userId || 'anonymous',
            pool,
            body.metadata
          );

          await pool.end();
          return send(200, { ok: true });
        } catch (e: any) {
          console.error("POST /api/ab/impression error:", e?.message || e);
          return send(500, { error: "failed to record impression" });
        }
      }

      if (req.method === "POST" && url.pathname === "/api/ab/conversion") {
        // Record A/B test conversion
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const bodyText = Buffer.concat(chunks).toString("utf8");
        const body = bodyText ? JSON.parse(bodyText) : {};

        try {
          const { default: pg } = await import("pg");
          const { Pool } = pg;
          const pool = new Pool({ connectionString: cfg.postgresUrl });
          const { recordConversion } = await import('./services/ab-testing.js');

          await recordConversion(
            body.experimentId,
            body.variantId,
            body.userId || 'anonymous',
            pool,
            body.metadata
          );

          await pool.end();
          return send(200, { ok: true });
        } catch (e: any) {
          console.error("POST /api/ab/conversion error:", e?.message || e);
          return send(500, { error: "failed to record conversion" });
        }
      }

      return send(404, { error: "Route not found" });
    } catch (err: any) {
      console.error(err);
      return send(500, { error: "Internal error", detail: err?.message });
    }
  });

  server.listen(port, () => {
    console.log(`[present-agent] HTTP listening on http://localhost:${port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
