# Present-Agent: AGENTS Guide

This document provides working guidance for LLM agents and contributors operating in this repository. It covers scope, conventions, data handling, and the prototype implementation plan.

**IMPORTANT: This project runs exclusively in Five-DB mode (Postgres, Neo4j, Vector DB, Redis, Event Store). Simple/in-memory mode has been removed.**

Refer to the product vision for context and objectives: see `product_vision.md`.

## Scope of the Prototype

- Goal: Ship a web-based AI gift recommendation assistant that ingests product catalogs, learns user/recipient context, and generates personalized gift suggestions via a conversational UI.
- Mode: Five-database architecture (Postgres, Neo4j, Vector DB, Redis, Event Store).
- Duration: Rapid prototype suitable for closed beta testing with a handful of users.
- Out of scope (for this phase): multi-channel messaging integrations, production-grade security/compliance, payments, logistics integrations.

## User-Centric Recommendation Hypothesis

- Baseline systems (Google Shopping, Amazon) optimize for generic product search and do not model "who you’re shopping for," their evolving tastes, or the "why" behind a gift.
- Our hypothesis: A relationship- and context-centered algorithm will outperform generic rec engines on perceived relevance and decision speed by:
  - Modeling gifters, recipients, relationships, occasions, and values (e.g., sustainable, handmade, local).
  - Persisting memory and feedback to compound value over time (planning, deciding, remembering recurring occasions).
  - Explaining recommendations with empathetic, culturally sensitive rationales that reduce anxiety and increase confidence.
- Measurement plan is in `README.md` (Evaluation Plan) and `product_vision.md` (Core Assumptions, Metrics).

## High-Level Architecture

- Frontend: Next.js web app with a chat interface (text first; stub voice capture). Minimal session state stored client-side.
- Backend API: Node/TypeScript for ingestion, search, recommendation, and feedback.
- Stores:
  - PostgreSQL — users, gifters/recipients, products, sessions, transactions, occasions, preferences.
  - Neo4j — relationship graph: Person, Relationship, Occasion, Gift, Vendor, Category; edges: knows, gifts_to, likes, values, rec_for.
  - Vector DB — product embeddings, user/recipient/profile embeddings, interaction embeddings (e.g., Qdrant, pgvector, or similar).
  - Redis — real-time state: session, conversation scratchpad, hot rec caches, rate limits, feature flags.
  - Event Store — append-only behavior log for learning (Kafka, Redpanda, or a Postgres-backed event table in dev).
- Embeddings + LLM: OpenAI or compatible provider for embeddings and chat/reasoning; thin RAG layer on the catalog + context graph.

See vision and rationale in `product_vision.md` (Architecture and Front End sections).

## Data Handling and Schema

Input data examples (see repo root) include `Gift & special events products (1).json` and `Produits variés.json`. These share a mostly consistent schema with minor inconsistencies:

- Fields: `id`, `Website`, `handle`, `sku`, `title`, `Description`, `vendor`, `price`, `availabilty` (note misspelling), `image`, `catégories` (accented), `url`.
- Common issues: empty `Description`, empty `sku`, empty/heterogeneous `catégories`, spelling/locale variations.

Canonical schema for ingestion (normalize to snake_case):

- `id` (string) — stable external identifier (or generated UUID).
- `source_website` (string)
- `handle` (string)
- `sku` (string | null)
- `title` (string)
- `description` (string | null)
- `vendor` (string | null)
- `price` (number)
- `currency` (string, default `USD` unless source provides otherwise)
- `available` (boolean)
- `category` (string | null)
- `image_url` (string | null)
- `product_url` (string)
- `tags` (string[])
- `attributes` (JSON) — free-form key/values from the source.

User data and memory:

- `users` — `{ id (uuid), email, name?, created_at }`
- `user_context` — latest parsed preferences per user as JSON `{ notes?: string, budgetMin?: number, budgetMax?: number, categories?: string[], vendors?: string[], values?: string[] }`
- `conversations` & `messages` — append-only chat history keyed to user; minimal fields: `{ conversation_id, role, content, created_at }`
- `feedback` & `events` — existing tables for thumbs up/down and learning events

Context rules:
- All context must be obtained via natural language (voice or text) — no mandatory dropdowns.
- The assistant should ask for: occasion, relationship, budget (min/max or under/max), and preferences/values — but conversationally and minimally.
- Extract obvious budgets (e.g., “under $50”, “20-40”, “between 20 and 40”) and store them in `user_context` alongside the raw `notes` text; do not overfit or make brittle assumptions.
- When categories/vendors/values are known, upsert into Neo4j as LIKES relations for graph-aware re‑ranking.
- Always merge stored context into retrieval: use saved budgets when query omits them; apply saved categories when none were provided; and append notes to the query text (length‑capped).

Normalization rules:

- Map `Website` → `source_website`, `Description` → `description`, `catégories` → `category`, fix `availabilty` → `available`.
- Trim whitespace; drop HTML if present in descriptions; enforce URL formats.
- Derive `tags` from category/vendor/handle and simple NLP keyword extraction.
- Default `currency` from source site or fallback to `USD`.

Category policy:
- **Canonical taxonomy** is defined in `data/canonical_taxonomy.json` with ~25 standard gift categories
- Map vendor categories to canonical ones via the `category_mappings` table (admin UI: `/admin/mappings`)
- After import, run `suggest:categories` and `ensure:categories`. The latter auto‑accepts the highest‑confidence suggestion as the Primary category for any unlabeled product; if none exists it falls back to the vendor's majority category or the global top category. No product should remain uncategorized.
- For graph DB and recommendation consistency, always use canonical categories, not raw vendor strings

Ingestion tool:

- Script: `scripts/ingest.mjs`
- Usage:
  - `node scripts/ingest.mjs` — scans `data/raw/*.json` and known root files.
  - `node scripts/ingest.mjs file1.json file2.json` — explicit files.
- Output: `data/processed/unified_catalog.json` and `data/processed/stats.json`.
- Augmentations: derives `tags` from title/vendor/handle/category; strips HTML from descriptions; guesses currency from TLD (`.ca` → `CAD`, else `USD`).

## Repository Layout (current)

```
present-agent/
  product_vision.md
  AGENTS.md
  README.md
  data/
    raw/                      # input JSON files
    processed/                # normalized exports for debugging
  db/
    sql/
      schema.sql             # Postgres schema
  scripts/                   # CLI utilities (ingest/import/ensure/index)
    ingest.mjs
    import_postgres.mjs
    suggest_categories.mjs
    ensure_categories.mjs
    index_qdrant.mjs
    dev_all.mjs
  src/
    server/
      index.ts               # Single HTTP server defining all routes
      config.ts
      types.ts
      services/
        catalog.ts
        embeddings.ts
        recommend.ts
        prompts/
          chat.ts
      adapters/
        fivedb/
          catalog.postgres.ts
          graph.neo4j.ts
          vector.qdrant.ts
          realtime.redis.ts
          events.redpanda.ts
    web/
      app/                   # Next.js app dir
        page.tsx             # Chat UI
        auth/page.tsx
        products/page.tsx
        products/[id]/page.tsx
        admin/products/page.tsx
        admin/suggestions/page.tsx
        admin/auto-categories/page.tsx
        layout.tsx
        globals.css
      components/
        ... (cards, drawers, header/footer)
      lib/
        api.ts               # fetch helpers
```

Agents should propose minimal viable stubs before generating full implementations.

## Agent Operating Guidelines

- Keep changes focused; avoid unrelated refactors. Follow the conventions above.
- Use concise, typed interfaces. Prefer `zod` for request/response validation.
- Privacy: Do not store raw PII beyond what is essential for the prototype. Use synthetic data for demos.
- Content policy: Avoid recommending harmful/illegal items; respect cultural sensitivity as per `product_vision.md`.
- Prompts: Keep system and developer prompts in-versioned files under `src/server/services/prompts/` when added. Include rationale and evaluation notes.
- Memory & personalization: Ensure any new prompts or tools use natural language to elicit missing context; resist adding structured inputs. Store the minimal but sufficient signals in `user_context` and graph, and always display short, sensitive rationales in recommendations.
- Transparency: Whenever recommendations are shown, include a short, friendly summary of which inputs were used (e.g., recipient, budget, values, categories) and remind users they can manage memory. Keep this to one sentence.
- Privacy: Only store what’s essential for personalization (budgets, categories, values, short notes); avoid storing raw PII or full transcripts unless explicitly approved. Provide a path to view/delete stored context.

## Memory & Conversation Contracts

- Endpoints
  - `POST /api/context` & `GET /api/context` — save/fetch last known context for the session user
  - `POST /api/chat/log { role, content }` & `GET /api/history` — minimal conversation logging for learning and evaluation
  - `POST /api/recommend` — server auto‑sets `recipientId` from session and merges stored context
- Neo4j upserts via `GraphStore.upsertRelationshipGraph` when categories/vendors/values are provided.
- Vector retrieval is optional; fall back to keyword search and never break the chat flow.


## 5-Database Mapping and Contracts

- PostgreSQL (Core):
  - Tables: `users`, `recipients`, `relationships`, `occasions`, `products`, `vendors`, `sessions`, `transactions`, `preferences`, `feedback`.
  - APIs: CRUD for core entities; read APIs feed features to recommenders.
  - Implemented now: `vendors`, `categories`, `products` (see `db/sql/schema.sql`). Importer: `scripts/import_postgres.mjs` (requires `pg`).
- Neo4j (Context Graph):
  - Nodes: `Person`, `Recipient`, `Gifter`, `Occasion`, `Gift`, `Vendor`, `Category`.
  - Edges: `KNOWS`, `GIFTS_TO`, `LIKES`, `VALUES`, `RECOMMENDED_FOR`, `PURCHASED`.
  - Queries: subgraph extraction for target recipient, paths for shared values/interests, re-ranking features.
- Vector DB (Retrieval):
  - Collections: `products`, `profiles`, `interactions`.
  - Index: cosine/inner-product over embedding vectors; top-k search with filters (price, availability, category).
- Redis (Realtime):
  - Keys: `session:{id}`, `ctx:{conversationId}`, `hotrec:{recipientId}`, `rate:{userId}`.
  - TTL-based caches for speed; ephemeral state only.
- Event Store (Learning):
  - Events: `viewed`, `clicked`, `shared`, `purchased`, `liked`, `dismissed`, `scheduled`, `reminded`.
  - Consumers: offline training, heuristic updates, evaluation dashboards.

## Prototype Milestones

1) Ingest + Normalize: ETL from sample JSON; expose `/api/search`.
2) Embeddings + RAG: Embed fields, top-k retrieval, prompt to justify recommendations.
3) Chat UX: 2–3 turns to 3–5 gift suggestions with rationale and links.
4) Feedback Loop: thumbs up/down + rationale capture; store in `feedback` and Event Store.
5) Wire Postgres, Redis, Vector DB, Neo4j, Event Store; preserve the TypeScript interfaces.
6) Evaluation: baseline vs. Amazon/Google with curated tasks and user study (see README Evaluation Plan).

## Environment and Secrets (for LLMs and humans)

Set via `.env` or environment variables:

- `OPENAI_API_KEY` — for embeddings and chat (or compatible provider).
- `MODEL_NAME` — chat/generation model, e.g., `gpt-4o-mini`.
- `EMBEDDING_MODEL` — embeddings model, e.g., `text-embedding-3-small`.
- `POSTGRES_URL` — core relational store.
  - `NEO4J_URL`, `NEO4J_USER`, `NEO4J_PASSWORD` — relationship graph.
  - `VECTOR_DB_URL` — vector database endpoint (or `POSTGRES_URL` with pgvector).
  - `QDRANT_API_KEY` — optional, if using Qdrant Cloud with auth.
  - `REDIS_URL` — realtime cache/state.
  - `EVENT_BROKERS` — Kafka/Redpanda brokers (or `EVENT_STORE_URL` if HTTP-based).

Optional:

- `VECTOR_DIM` — embedding dimension for schema setup.
- `LOG_LEVEL` — `info|debug|warn|error`.

### One‑Command Local Dev (Five‑DB)

- Prerequisites: Docker Desktop, Node 18+, a `.env.local` with at least:
  - `NEXT_PUBLIC_API_BASE=http://localhost:3001`
  - `PORT=3001`
  - `POSTGRES_URL=postgres://present:present@localhost:5432/present`
  - Optional to enable extras: `NEO4J_URL`, `NEO4J_USER`, `NEO4J_PASSWORD`, `VECTOR_DB_URL`, `OPENAI_API_KEY`, `REDIS_URL`, `EVENT_BROKERS`.

- Start everything with a single command:
  - `npm run dev:five`

What it does:
- Brings up Docker services (`postgres`, `neo4j`, `qdrant`, `redis`, `redpanda`).
- Starts the API on `:3001` and waits for `/api/search` to be healthy.
- Runs `npm run ingest` and `npm run import:postgres` to load sample products.
- Runs `npm run suggest:categories` then `npm run ensure:categories` to auto‑assign a primary category (best suggestion → vendor‑majority → global‑top).
- Indexes Qdrant if `VECTOR_DB_URL` and `OPENAI_API_KEY` are set.
- Starts the Next.js web app on `:3000` and attempts to open your browser.

Notes:
- If Docker is unavailable, the script continues assuming services are already running locally.
- You can still run pieces manually: `docker compose up -d postgres` → `npm run dev` → `npm run web:dev`.

### Coding Conventions & Tips

- Types & imports
  - Prefer explicit types; avoid `any` where possible.
  - ESM only, `.ts` source. Dynamic imports should use `.ts` paths in this repo.
- SSR and client state
  - Do not read `localStorage` during SSR; defer client-only reads to `useEffect` to avoid hydration mismatch.
- Prompts
  - Keep under `src/server/services/prompts/` with rationale & few-shot where helpful.
- Extraction
  - Extend `extract.ts` with synonyms & helper matchers. Avoid heavy logic in the route handler.
- Rationale
  - Always supply short human rationales (budget fit, category/interest match). Use server-side when possible, client-side fallback otherwise.
- Admin Tools
  - Keep “mappings” and “suggestions” flows independent from ingest; scripts handle backfill/ensure steps.
  - Auto‑approval policy: prefer auto‑assigning a primary category via `ensure:categories` so UI flows never lack a category. Expose controls on the product page to change/add categories rather than blocking on review.
  - Audit: `/admin/auto-categories` lists auto‑assigned primary categories with a filter by method (`suggestion`, `vendor_majority`, `global_top`) to help prioritize human review.

### Deployment (Frontend on Vercel, Backend elsewhere)

- Frontend (Vercel)
  - Project root: `src/web`
  - Build: `npm run web:build`
  - Start: `npm run web:start`
  - Required env: `NEXT_PUBLIC_API_BASE` → public URL of backend API
  - Optional: analytics keys
- Backend (Render/Fly/Heroku/VM)
  - Start: `npm run dev` (or production PM2/Node process using `dist` transpile if desired)
  - Required env: `POSTGRES_URL` (+ Neo4j/Qdrant/Redis if used), `OPENAI_API_KEY` if embeddings/chat enabled
  - Expose port 3001 (or set `PORT`)
- Datastores (managed or Docker)
  - Postgres, Neo4j, Qdrant, Redis, Redpanda per `docker-compose.yml`
- Link Frontend → Backend
  - On Vercel, set `NEXT_PUBLIC_API_BASE=https://your-api.example.com`

### Release Process

- GitHub
  - Ensure `node_modules` and `.env.local` are ignored (`.gitignore` already covers them)
  - `git init && git add -A && git commit -m "init"`
  - `git branch -M main && git remote add origin <your-repo-url> && git push -u origin main`
- Vercel
  - Connect GitHub repo; set Project Root to `src/web`
  - Set `NEXT_PUBLIC_API_BASE` in Vercel Project Settings → Environment Variables
  - Trigger deploy
- Backend host
  - Provision Postgres and set `POSTGRES_URL`
  - Run: `npm run ingest && npm run import:postgres` (one-time)
  - Optional: `npm run enrich:products && npm run suggest:categories && npm run ensure:categories`
  - Start server process

### Environment Loading Policy

- Always load environment variables from a root-level `.env.local` file in addition to the process environment.
- Precedence: process environment > `.env.local` > `.env` (defaults only). Do not override explicitly provided env vars.
- For Node/TypeScript entrypoints and scripts, use `dotenv` (e.g., `import 'dotenv/config'` in the top-level server index and CLI scripts, or run with `node -r dotenv/config ...`).
- Keep secrets out of version control. `.env.local` is developer‑local and must not be committed.
- When adding new config keys, document them here and ensure they are read from `.env.local` consistently.

## Testing and Validation

- Unit-test normalization (mapping inputs → canonical schema).
- Smoke-test `/api/recommend` with seed conversations and check response shape.
- Log latency budgets per `product_vision.md` (<500ms pipeline target is aspirational for prototype; measure and report).
- Establish baselines vs Amazon/Google Shopping on identical prompts; collect side-by-side ratings (relevance, confidence, time-to-decision) and task completion outcomes.

## Recommendation & Personalization Vision

**See `PERSONALIZATION_RECOMMENDATIONS.md` for comprehensive guidance on building world-class personalization.**

The recommendation system has evolved from simple keyword search to a sophisticated hybrid semantic search architecture:

### Current State (Implemented)
- **Hybrid Semantic Search**: Vector search (Qdrant) with OpenAI embeddings + PostgreSQL full-text fallback
- **Cohere Reranking**: State-of-the-art rerank-english-v3.0 model for final quality polish
- **Facet-Aware Scoring**: Multi-signal boosting (0.4 occasion, 0.3 recipient/interests, 0.2 values)
- **Cross-Category Discovery**: Semantic search finds relevant products regardless of rigid category constraints
- **Graceful Degradation**: Falls back from vector → keyword → defaults with zero failures

### Architecture Overview
```
User Query
    ↓
[1] Intent Extraction (extract.ts)
    ↓
[2] Context Merging (stored preferences + current query)
    ↓
[3] Vector Search (Qdrant, 30 candidates, budget filters only)
    ↓
[4] Facet Boosting (occasion, recipient, interests, values)
    ↓
[5] Graph Boosting (Neo4j relationship preferences, optional)
    ↓
[6] Cohere Reranking (30→15 results, semantic relevance)
    ↓
[7] Rationale Generation (explain why each gift fits)
    ↓
Results (15 personalized, explained recommendations)
```

### Key Files
- **`src/server/services/recommend.ts`**: Main recommendation orchestration
- **`src/server/services/reranker.ts`**: Cohere reranking service
- **`src/server/services/extract.ts`**: Intent extraction (interests, categories, recipients, occasions)
- **`src/server/adapters/fivedb/vector.qdrant.ts`**: Vector search with semantic similarity
- **`src/server/adapters/fivedb/catalog.postgres.ts`**: Keyword search fallback + facet queries

### Future Roadmap (See PERSONALIZATION_RECOMMENDATIONS.md)

**Phase 1: User-Level Personalization**
- User embeddings from interaction history
- Collaborative filtering ("users like you also liked")
- Purchase history analysis for budget/category preferences

**Phase 2: Context-Aware Intelligence**
- Recipient relationship modeling (what works for each person you gift)
- Occasion pattern learning (seasonal trends, timing)
- Temporal & urgency signals (fast shipping for urgent needs)

**Phase 3: Product Intelligence**
- LLM-powered auto-facet extraction (scale to thousands of products)
- Multi-modal embeddings (reviews + tags + category hierarchy)
- Trend detection & seasonal boosting

**Phase 4: Behavioral Signals**
- Click & dwell time tracking (implicit feedback)
- Conversation analysis (learn from chat patterns)
- A/B testing with multi-armed bandits

**Phase 5: Advanced Techniques**
- Graph neural networks for product relationships
- Reinforcement learning for session optimization
- Diversity balancing (MMR for serendipity)

**Phase 6: Real-Time Personalization**
- Session-based recommendations (adapt within conversation)
- Streaming updates with Redis (real-time preference learning)

### Guiding Principles for LLM Agents

When working on recommendation/personalization features:

1. **Semantic Understanding Over Keywords**: Prefer vector/embedding approaches that understand "lure making kit" → "fishing" connections
2. **Multi-Signal Fusion**: Combine explicit (ratings), implicit (clicks), and contextual (occasion) signals
3. **Graceful Degradation**: Always provide fallbacks; never break the user experience
4. **Explainability**: Every recommendation needs a human-readable rationale
5. **Privacy-First**: Only store what's essential; provide deletion paths
6. **Measurable Impact**: Track CTR, conversion rate, time-to-decision, user satisfaction

### Quick Wins for LLM Agents

If you're enhancing the recommendation system, start here:

1. **LLM Facet Extraction** (4hrs, high impact): Use Claude/GPT to auto-extract facets from product titles/descriptions
2. **Session Tracking** (6hrs, medium-high impact): Track clicked categories and inferred price ranges within session
3. **Trending Badge** (3hrs, medium impact): Query events table for spike detection, add "Trending" indicator
4. **Occasion Auto-Detection** (2hrs, medium impact): Use current date to infer likely occasions (Christmas, Valentine's, etc.)

## References

- Product Vision: `product_vision.md`
- Personalization Roadmap: `PERSONALIZATION_RECOMMENDATIONS.md`
- Facet System: `FACETS.md`
- This guide: `AGENTS.md`
- User setup and commands: `README.md`
