import { CatalogStore, Product, SearchQuery } from "../../types.js";
import pkg from "pg";

const { Pool } = pkg;

function rowToProduct(row: any): Product {
  return {
    id: String(row.id),
    sourceWebsite: row.source_website || undefined,
    handle: row.handle || undefined,
    sku: row.sku || null,
    title: row.title,
    description: row.description || null,
    vendor: row.vendor_name || null,
    price: Number(row.price),
    currency: row.currency || undefined,
    available: !!row.available,
    category: row.category_name || null,
    imageUrl: row.image_url || null,
    productUrl: row.product_url,
    tags: row.tags || [],
    attributes: row.attributes || {},
  };
}

export class PostgresCatalog implements CatalogStore {
  private pool: typeof Pool.prototype;

  constructor(private url: string) {
    this.pool = new Pool({ connectionString: url });
  }

  getPool(): typeof Pool.prototype {
    return this.pool;
  }

  async ingest(products: Product[]): Promise<number> {
    // Simple upsert mirroring the import script for convenience
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const p of products) {
        let vendorId: number | null = null;
        if (p.vendor) {
          const v = await client.query(
            `INSERT INTO vendors(name) VALUES ($1)
             ON CONFLICT(name) DO UPDATE SET name = EXCLUDED.name
             RETURNING id`,
            [p.vendor]
          );
          vendorId = v.rows[0].id;
        }
        let categoryId: number | null = null;
        if (p.category) {
          const c = await client.query(
            `INSERT INTO categories(name) VALUES ($1)
             ON CONFLICT(name) DO UPDATE SET name = EXCLUDED.name
             RETURNING id`,
            [p.category]
          );
          categoryId = c.rows[0].id;
        }
        await client.query(
          `INSERT INTO products(
            id, vendor_id, category_id, source_website, handle, sku, title, description,
            price, currency, available, image_url, product_url, tags, attributes
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,
            $9,$10,$11,$12,$13,$14,$15
          ) ON CONFLICT(id) DO UPDATE SET
            vendor_id = EXCLUDED.vendor_id,
            category_id = EXCLUDED.category_id,
            source_website = EXCLUDED.source_website,
            handle = EXCLUDED.handle,
            sku = EXCLUDED.sku,
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            price = EXCLUDED.price,
            currency = EXCLUDED.currency,
            available = EXCLUDED.available,
            image_url = EXCLUDED.image_url,
            product_url = EXCLUDED.product_url,
            tags = EXCLUDED.tags,
            attributes = EXCLUDED.attributes`,
          [
            String(p.id),
            vendorId,
            categoryId,
            p.sourceWebsite || null,
            p.handle || null,
            p.sku || null,
            p.title,
            p.description || null,
            Number.isFinite(p.price) ? p.price : 0,
            p.currency || "USD",
            !!p.available,
            p.imageUrl || null,
            p.productUrl,
            p.tags || [],
            p.attributes || {},
          ]
        );
      }
      await client.query("COMMIT");
      return products.length;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async search(q: SearchQuery): Promise<Product[]> {
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug('[catalog.search] query', JSON.stringify(q, null, 2));
    }

    const clauses: string[] = [];
    const params: any[] = [];
    let i = 1;

    // Budget filters
    if (typeof q.budgetMin === "number") {
      clauses.push(`p.price >= $${i}`);
      params.push(q.budgetMin);
      i++;
    }
    if (typeof q.budgetMax === "number") {
      clauses.push(`p.price <= $${i}`);
      params.push(q.budgetMax);
      i++;
    }

    // Category filter
    if (q.categories && q.categories.length > 0) {
      clauses.push(`c.name = ANY($${i})`);
      params.push(q.categories);
      i++;
    }

    // Facet filters
    if (q.facets?.occasion) {
      clauses.push(`EXISTS (
        SELECT 1 FROM product_facets pf
        WHERE pf.product_id = p.id
        AND pf.facet_key = 'occasion'
        AND pf.facet_value = $${i}
      )`);
      params.push(q.facets.occasion);
      i++;
    }

    if (q.facets?.recipients && q.facets.recipients.length > 0) {
      // Support multiple recipient patterns (e.g., ['for_her', 'her'])
      clauses.push(`EXISTS (
        SELECT 1 FROM product_facets pf
        WHERE pf.product_id = p.id
        AND pf.facet_key = 'recipient'
        AND pf.facet_value = ANY($${i})
      )`);
      params.push(q.facets.recipients);
      i++;
    } else if (q.facets?.recipient) {
      // Fallback to single recipient
      clauses.push(`EXISTS (
        SELECT 1 FROM product_facets pf
        WHERE pf.product_id = p.id
        AND pf.facet_key = 'recipient'
        AND pf.facet_value LIKE $${i}
      )`);
      params.push(`%${q.facets.recipient}%`);
      i++;
    }

    if (q.facets?.interests && q.facets.interests.length > 0) {
      clauses.push(`EXISTS (
        SELECT 1 FROM product_facets pf
        WHERE pf.product_id = p.id
        AND pf.facet_key = 'interest'
        AND pf.facet_value = ANY($${i})
      )`);
      params.push(q.facets.interests);
      i++;
    }

    if (q.facets?.values && q.facets.values.length > 0) {
      clauses.push(`EXISTS (
        SELECT 1 FROM product_facets pf
        WHERE pf.product_id = p.id
        AND pf.facet_key = 'value'
        AND pf.facet_value = ANY($${i})
      )`);
      params.push(q.facets.values);
      i++;
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const limit = Math.min(q.limit ?? 10, 50);
    const offset = Math.max(q.offset ?? 0, 0);

    // Use full-text search for relevance ranking when text is provided AND no facet filters exist
    // If facets are filtering, they're already specific enough - full-text would be too restrictive
    const hasFacetFilters = q.facets && (q.facets.occasion || q.facets.recipients || q.facets.recipient ||
                                         (q.facets.interests && q.facets.interests.length > 0) ||
                                         (q.facets.values && q.facets.values.length > 0));
    const hasCategories = q.categories && q.categories.length > 0;

    let sql: string;
    if (q.text && !hasFacetFilters && !hasCategories) {
      // Only use full-text search when we don't have other filters
      const textParam = i;
      params.push(q.text);
      i++;

      sql = `
        SELECT p.*,
               v.name AS vendor_name,
               c.name AS category_name,
               ts_rank(
                 to_tsvector('english', p.title || ' ' || COALESCE(p.description, '')),
                 plainto_tsquery('english', $${textParam})
               ) AS rank
        FROM products p
        LEFT JOIN vendors v ON v.id = p.vendor_id
        LEFT JOIN categories c ON c.id = p.category_id
        ${where}
        ${where ? 'AND' : 'WHERE'} (
          to_tsvector('english', p.title || ' ' || COALESCE(p.description, ''))
          @@ plainto_tsquery('english', $${textParam})
        )
        ORDER BY rank DESC, p.updated_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (q.text) {
      // Text for ranking only, not filtering (when facets/categories already filter)
      const textParam = i;
      params.push(q.text);
      i++;

      sql = `
        SELECT p.*,
               v.name AS vendor_name,
               c.name AS category_name,
               ts_rank(
                 to_tsvector('english', p.title || ' ' || COALESCE(p.description, '')),
                 plainto_tsquery('english', $${textParam})
               ) AS rank
        FROM products p
        LEFT JOIN vendors v ON v.id = p.vendor_id
        LEFT JOIN categories c ON c.id = p.category_id
        ${where}
        ORDER BY rank DESC, p.updated_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      // No text search, just order by updated_at
      sql = `
        SELECT p.*, v.name AS vendor_name, c.name AS category_name
        FROM products p
        LEFT JOIN vendors v ON v.id = p.vendor_id
        LEFT JOIN categories c ON c.id = p.category_id
        ${where}
        ORDER BY p.updated_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    if (process.env.LOG_LEVEL === 'debug') {
      console.debug('[catalog.search] SQL (full)', sql.replace(/\s+/g, ' '));
      console.debug('[catalog.search] params', params);
    }

    const res = await this.pool.query(sql, params);

    if (process.env.LOG_LEVEL === 'debug') {
      console.debug(`[catalog.search] returned ${res.rows.length} products`);
    }

    return res.rows.map(rowToProduct);
  }

  async getById(id: string): Promise<Product | null> {
    const res = await this.pool.query(
      `SELECT p.*, v.name AS vendor_name, c.name AS category_name
       FROM products p
       LEFT JOIN vendors v ON v.id = p.vendor_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id = $1
       LIMIT 1`,
      [id]
    );
    if (res.rows.length === 0) return null;
    return rowToProduct(res.rows[0]);
  }

  async listCategories(): Promise<string[]> {
    const res = await this.pool.query(`SELECT name FROM categories ORDER BY name ASC`);
    return res.rows.map((r: any) => String(r.name));
  }
}
