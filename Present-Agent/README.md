# Present-Agent

AI gift recommendation assistant prototype. This repo ingests merchant product catalogs, normalizes them, and powers a conversational UI that proposes thoughtful, context-aware gifts.

## Documentation

- **Product Vision**: `product_vision.md` - Background, goals, and hypothesis
- **Agent Guidelines**: `AGENTS.md` - Development conventions, architecture, recommendation vision
- **Personalization Roadmap**: `PERSONALIZATION_RECOMMENDATIONS.md` - Advanced personalization techniques
- **Facet System**: `FACETS.md` - Gift-relevant attribute extraction

### For LLM Agents

Comprehensive guides for AI assistants working on the recommendation system:

- **`docs/LLM_RECOMMENDATION_GUIDE.md`** - Complete recommendation pipeline, semantic search, scoring, and reranking
- **`docs/LLM_FACET_EXTRACTION_GUIDE.md`** - Automated facet extraction from product data
- **`docs/LLM_RATIONALE_GUIDE.md`** - Generating compelling, personalized gift explanations

Note: This project runs exclusively in Five‑DB mode (Postgres, Neo4j, Vector DB, Redis, Event Store). Simple mode has been removed.

## Prototype Scope

- Web UI (Next.js) with a simple chat to collect context and display 3–5 recommended gifts.
- Backend endpoints for ingestion, search, and recommendation using embeddings + lightweight RAG over the catalog and context graph.
- Five‑Database Mode only: Postgres, Neo4j, Vector DB, Redis, Event Store.
- OpenAI (or compatible) models for embeddings and chat.

Out of scope for this phase: multi-channel messaging, payments/logistics, production hardening.

## Hypothesis (Why We’ll Win)

Amazon/Google optimize generic product search; they don’t really know who you’re shopping for, what they value, or why you’re buying. Our user-centric algorithm models gifters, recipients, relationships, occasions, and values, learns from feedback, and explains recommendations empathetically. We believe this will reduce anxiety, speed decisions, and improve satisfaction, especially for planning, deciding, and remembering recurring gifting occasions.

## Getting Started

1) Prerequisites
- Node.js 18+
- pnpm or npm

2) Environment
Create a `.env.local` (or use `.env.example`) at the project root. Minimal local setup:

```
NEXT_PUBLIC_API_BASE=http://localhost:3001
PORT=3001
POSTGRES_URL=postgres://present:present@localhost:5432/present

# Optional (enable features if running these services)
OPENAI_API_KEY=
MODEL_NAME=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small
VECTOR_DIM=1536
NEO4J_URL=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=neo4j_password
NEO4J_DATABASE=neo4j
VECTOR_DB_URL=http://localhost:6333
REDIS_URL=redis://localhost:6379
EVENT_BROKERS=localhost:9092
LOG_LEVEL=info
```

3) Install deps

```
pnpm install
# or
npm install
```

4) Run (One Command)

```
# Five‑DB local dev (starts Docker services, API, imports, auto‑assigns categories, vectors if configured, and web)
npm run dev:five
```

Note: Docker Desktop must be installed and running.

5) Smoke check

Server starts at `:3001` and Next.js at `:3000` via `npm run dev:five`. Visit http://localhost:3000.

Troubleshooting hydration warnings (Next.js)
- If you see a hydration mismatch on the home page, hard-refresh the browser (Cmd/Ctrl+Shift+R).
- We defer localStorage reads to `useEffect` to keep server/client markup aligned; if you fork the chat UI, avoid reading client‑only state during initial render.

## HTTP API

Start the JSON API (Postgres‑backed; five‑DB only):

```
export POSTGRES_URL=postgres://present:present@localhost:5432/present
PORT=3001 npm run dev
```

Key endpoints:
- `GET /api/search?text=ring&budgetMin=20&budgetMax=100&category=Costumes&limit=5` — search catalog
- `GET /api/products/:id` — product detail + facets + suggestions + additional categories
- `POST /api/recommend` — recommend items from query `{ query: { text, budgetMin?, budgetMax?, categories? } }`
- `POST /api/chat` — conversational UX; extracts context and recommends or asks for missing info
- `POST /api/products/:id/category?mode=primary|additional` — set primary or add additional category
- `GET /api/categories` and `GET /api/vendors` — filter sources
- Admin:
  - `GET /api/products_audit` — internal list view (with joins and pagination)
  - `GET /api/admin/suggestions?status=pending|accepted|rejected` — suggestions queue (historical)
  - `POST /api/admin/suggestions/:id?action=accept|reject&mode=primary|additional` — act on suggestion
  - `GET /api/admin/auto_categories?method=all|suggestion|vendor_majority|global_top` — audit auto‑assigned categories

## One-Command Dev

Run Docker services, import catalog, start API + Web:

```
npm run dev:five
```

Behavior:
- Brings up Docker services (`postgres`, `neo4j`, `qdrant`, `redis`, `redpanda`).
- Starts the API on `:3001` and waits for `/api/search` to be healthy.
- Five‑DB mode: runs `ingest` + `import:postgres`, then `suggest:categories` and `ensure:categories` to auto‑assign a primary category to every product (accepts best suggestion; vendor‑majority and global‑top fallbacks ensure no product is left uncategorized). If `VECTOR_DB_URL` and `OPENAI_API_KEY` are set, runs `index:qdrant`.
- Starts Next.js dev on `:3000` and attempts to open your browser.

## Deployment Guide

Frontend on Vercel
- Project root: `src/web` (set in Vercel → Project Settings → Root Directory)
- Build Command: `npm run web:build`
- Output Directory: `.next`
- Install Command: `npm install`
- Environment Variables:
  - `NEXT_PUBLIC_API_BASE=https://your-api.example.com`

Backend (Render / Fly / Heroku / VM)
- App command: `npm run dev` (or `node dist/server/index.js` if you build)
- Required env:
  - `POSTGRES_URL`
  - `OPENAI_API_KEY` (optional; enables embeddings/chat)
  - `NEO4J_URL/USER/PASSWORD` (optional)
  - `VECTOR_DB_URL` (optional; Qdrant)
- One-time setup:
  - `npm run ingest`
  - `npm run import:postgres`
  - Optionally: `npm run enrich:products`, `npm run suggest:categories`, `npm run ensure:categories`

GitHub Setup
- `git init`
- `git add -A && git commit -m "Initial commit"`
- `git branch -M main && git remote add origin <your-repo-url>`
- `git push -u origin main`
- Connect repo in Vercel; set `NEXT_PUBLIC_API_BASE` env there; deploy.

CI (GitHub Actions)
- A basic CI workflow runs on pushes/PRs to `main`:
  - Installs dependencies
  - Runs TypeScript type-check
  - Builds the Next.js web app
- See `.github/workflows/ci.yml` to adjust (e.g., add lint/tests).

Vercel Config (optional vercel.json)
- `vercel.json` at repo root instructs Vercel to:
  - Install with `npm install`
  - Build with `npm run web:build`
  - Serve from `src/web/.next`
  - Dev command: `npm run web:dev`

## Chat UX & Persona

- The chat persona is defined in `src/server/services/prompts/chat.ts`.
- Principles: warm tone, mirror lightly, ask one focused follow-up, summarize in one line, propose 3–5 ideas with short rationales.
- Extraction uses `extract.ts` to infer interests/categories (books/kitchen/coffee) and values.
- The client adds a rationale if the server doesn’t include one.

## Admin Tools

- `Mappings`: `/admin/mappings` maps vendor source categories to your canonical taxonomy.
  - Apply mappings to existing rows: `npm run backfill:mappings`
- `Suggestions`: `/admin/suggestions` shows suggestion history. Suggestions are auto‑accepted as Primary during `ensure:categories`; use the product detail page to change the primary or add additional categories later.
- `Directory`: `/admin/products` lists products with joins for audit.
 - `Auto‑Categories`: `/admin/auto-categories` lists products whose primary category was auto‑assigned; filter by method (suggestion, vendor majority, global top) to prioritize review.

## Data Quality & Enrichment

- Category normalization: `category_mappings` table normalizes vendor→canonical category.
- Suggestions: `npm run suggest:categories` writes to `category_suggestions` with confidence.
- Category auto‑assignment: `npm run suggest:categories` proposes categories; `npm run ensure:categories` auto‑accepts the top suggestion as the Primary category for any unlabeled product and backfills `product_categories`. If no suggestion exists, it falls back to vendor‑majority or global‑top category so none remain uncategorized.
- Facets: `npm run enrich:products` writes rule-based facets (occasion, recipient, interest, values, materials, price_band).

## Troubleshooting

- Empty directory on `/products` or `/admin/products`:
  - Ensure Postgres up: `docker compose up -d postgres`
  - Import catalog: `npm run ingest && npm run import:postgres`
  - Assign categories: `npm run suggest:categories && npm run ensure:categories`
  - Verify API: `curl "$NEXT_PUBLIC_API_BASE/api/products_audit?limit=1"`
- Chat budget not recognized:
  - Supported: “under $50”, “between 20 and 40”, “20–40”, “spend 250”, “for 250”, “250 dollars”.
- Hydration mismatch on home page:
  - We defer `localStorage` reads until `useEffect`; hard refresh if needed.

## 5-Database Mode

The enhanced setup uses a hybrid store to model relationships and learning:

- PostgreSQL — core entities (users, recipients, products, sessions, transactions, occasions, preferences, feedback).
- Neo4j — relationship/context graph (people, occasions, values, categories, vendors).
- Vector DB — embeddings for products, profiles, interactions (Qdrant/pgvector-compatible).
- Redis — realtime session/context cache and hot recommendations.
- Event Store — append-only behavior log for learning (Kafka/Redpanda or Postgres table for dev).

Environment (compose or cloud):

```
POSTGRES_URL=postgres://user:pass@localhost:5432/present
NEO4J_URL=bolt://localhost:7687       # Or neo4j+s://... for Aura
NEO4J_USER=neo4j
NEO4J_PASSWORD=...
NEO4J_DATABASE=neo4j                  # Optional; used if provided
VECTOR_DB_URL=http://localhost:6333   # If Qdrant; or use pgvector via POSTGRES_URL
# QDRANT_API_KEY=...                  # Optional for Qdrant Cloud
REDIS_URL=redis://localhost:6379
EVENT_BROKERS=localhost:9092          # If Kafka; or EVENT_STORE_URL for HTTP
```

The API uses a single TypeScript interface with five‑DB adapters.

## Users, Sessions, And Memory

Present Agent supports lightweight accounts and durable, per‑user memory that improves with every conversation.

- Auth (cookie session)
  - `POST /api/auth/signup { email, name? }` → creates/returns user; sets `sid` HttpOnly cookie
  - `POST /api/auth/logout` → clears session
  - `GET /api/me` → `{ user | null }`
  - Frontend page: `/auth`

- Memory (Five‑DB tables)
  - `users` — `{ id (uuid), email, name, created_at }`
  - `user_context` — latest parsed preferences for the user as JSON (e.g., `{ notes, budgetMin, budgetMax, categories, vendors, values }`)
  - `conversations` — per‑user conversation id
  - `messages` — `{ conversation_id, role, content, created_at }` for user/assistant turns
  - `feedback` and `events` — used by the feedback loop

- Memory API
  - `POST /api/context` — saves the latest natural‑language notes and parsed budgets; when provided, upserts `categories/vendors/values` into Neo4j for graph re‑ranking
  - `GET /api/context` — returns the stored context for the signed‑in user
  - `POST /api/chat/log { role, content }` — appends a message to the current conversation
  - `GET /api/history` — returns recent messages in the current conversation
  - `GET /api/recipients` — lists known recipient keys for the signed‑in user
- `POST /api/chat { message }` — conversational orchestrator that (1) saves natural input to memory; (2) asks follow‑up if info is missing; (3) recommends when ready using merged memory and graph boosts
  - Responses include `reply` (assistant text), optional `contextSummary` (one‑line summary of inputs used), and optional `items` (recommendations)

- How recommendations use memory
  - The server merges `user_context` into each `POST /api/recommend` call:
    - fills in `budgetMin/Max` if omitted
    - applies `categories` if none are provided
    - appends `notes` to the query text (capped)
  - The session’s user id is automatically set as `recipientId`, enabling graph‑aware boosts if Neo4j is configured.

- CORS and cookies
  - The API returns `Access-Control-Allow-Origin: <request origin>` and `Access-Control-Allow-Credentials: true` so the browser can send/receive cookies.
  - The web app calls auth/context/recommend with `credentials: 'include'`.

Embedding vs Chat models
- Use a separate embedding model for retrieval quality and cost control.
- Env keys:
  - `EMBEDDING_MODEL=text-embedding-3-small` (default; 1536 dims)
  - `MODEL_NAME=gpt-4o-mini` (chat/generation; used when added)

### Vector Indexing (Qdrant)

For semantic search quality in five‑DB mode, index product embeddings into Qdrant:

```
docker compose up -d qdrant
export POSTGRES_URL=postgres://present:present@localhost:5432/present
export VECTOR_DB_URL=http://localhost:6333
export OPENAI_API_KEY=sk-...
export MODEL_NAME=text-embedding-3-small

# After importing products into Postgres
npm run index:qdrant
```

Once indexed, `POST /api/recommend` will use vector search when `VECTOR_DB_URL` is set (falls back to keyword search otherwise).

Graph-aware re‑ranking (prototype)
- If `NEO4J_URL/USER/PASSWORD` are set and the input contains a `recipientId`, the recommender boosts items whose `category` matches categories the recipient LIKES in Neo4j (see `Neo4jGraph.upsertRelationshipGraph`).

CLI to load preferences into Neo4j
```
# preferences.json: [{"recipientId":"r1","likes":{"categories":["Books"],"vendors":["Acme"]}}]
npm run graph:upsert-prefs preferences.json
```

## Data Ingestion

- Place raw catalogs in `data/raw/` (examples currently live at repo root: `Gift & special events products (1).json`, `Produits variés.json`).
- Normalize and unify to a single catalog JSON:

```
npm run ingest
# or explicitly
node scripts/ingest.mjs "Gift & special events products (1).json" "Produits variés.json"
```

- Outputs:
  - `data/processed/unified_catalog.json` — canonical products
  - `data/processed/stats.json` — quick data quality summary

- The ingestion script maps source fields to the canonical schema (see `AGENTS.md`). It strips HTML from descriptions, derives basic tags, and guesses currency from TLD.
- Next step: import the unified catalog into Postgres and (optionally) embed into Qdrant for semantic search.

## Postgres Import

Load the unified catalog into Postgres for the 5‑DB mode.

1) Start Postgres (via compose):

```
docker compose up -d postgres
```

2) Prepare environment:

```
export POSTGRES_URL=postgres://present:present@localhost:5432/present
```

3) Create schema and import data:

```
# Ensure you have created a unified catalog first
npm run ingest

# Install pg (one-time on your machine)
npm i pg

# Run importer (applies schema and upserts all products)
npm run import:postgres

# If you add or change mappings later, apply them without re-importing
npm run backfill:mappings

## Category Suggestions (Optional)

Generate category suggestions for unlabeled products using a lightweight centroid classifier (no external APIs):

```
npm run suggest:categories
# or with options
POSTGRES_URL=... node scripts/suggest_categories.mjs --threshold 0.6 --limit 5000
```

Writes to `category_suggestions` with `status='pending'` and a confidence score. You can review these and convert them into mappings (or directly update products) via admin tooling.
```

Notes:
- Schema is defined in `db/sql/schema.sql` (tables: vendors, categories, products).
- Importer upserts vendors/categories by name, and products by `id` with a unique index on `product_url`.
- If using Docker’s Postgres, the default credentials in `docker-compose.yml` match the example `POSTGRES_URL` above.

## Recommendation Flow (Prototype)

1) Collect context via chat: recipient profile, occasion, budget, constraints, cultural preferences.
2) Retrieve nearest products via vector search + rules filters (availability, price range, category exclusions).
3) Rank and compose: prompt the LLM to explain and justify the top N items with rationale and sensitivity to values (sustainable, local, handmade, etc.).
4) Present with links/images; allow feedback to refine.

See `product_vision.md` for metrics and experience goals (e.g., sub-2-minute satisfaction).

## Evaluation Plan

We will measure against baselines (Amazon/Google Shopping) on curated gifting tasks:

- Metrics: perceived relevance, clarity of rationale, time-to-first-confident-choice, intent to return, task success rate (gift purchased/saved), NPS.
- Protocol: side-by-side suggestions for identical prompts (recipient, occasion, budget, constraints); blind user rating; qualitative feedback.
- Learning: record feedback/events to the Event Store; iterate embeddings, graph features, and prompt strategies.

## Planned Structure

```
present-agent/
  product_vision.md
  AGENTS.md
  README.md
  data/
    raw/
    processed/
  src/
    server/
      index.ts
      routes/
        ingest.ts
        recommend.ts
        search.ts
      services/
        catalog.ts
        embeddings.ts
        recommend.ts
      db/
        sql/
          schema.sql
    web/
      app/
        page.tsx
        api/
      components/
        Chat.tsx
        Message.tsx
      lib/
        api.ts
```

## What You’ll Need

- OpenAI account and `OPENAI_API_KEY` (or compatible provider and keys).
- Local Node runtime and package manager.
- Five‑DB stack locally (via Docker compose) or cloud instances for Postgres, Neo4j, Vector DB (e.g., Qdrant/pgvector), Redis, and an Event Store (Kafka/Redpanda or a Postgres-backed table for dev).

## Notes on Privacy and Ethics

- Do not commit real user PII to the repo. Use synthetic data during development.
- Be mindful of cultural sensitivity in prompts and outputs; avoid harmful or inappropriate content.

## Links

- Vision and strategy: `product_vision.md`
- Agent guidelines: `AGENTS.md`
- Privacy & Data Retention
  - We store minimal, user‑approved context: budgets, optional categories/vendors/values, and short free‑text notes. No raw PII beyond email for login.
  - View: `GET /api/context` returns your stored context
  - Delete: `DELETE /api/context` erases your stored context (deletes from `user_context` and logs an `events` row)
  - Conversations are stored minimally to evaluate quality and improve prompts (role + content). Additions or deletions to policy should be reflected here before implementation.
