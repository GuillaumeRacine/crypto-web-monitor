#!/usr/bin/env tsx
/**
 * Index all products from Postgres into Qdrant with OpenAI embeddings
 * Usage: npx tsx scripts/index-products.ts
 */

import { config as dotenvConfig } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: path.join(__dirname, "../.env.local") });
dotenvConfig({ path: path.join(__dirname, "../.env") });

import { PostgresCatalog } from "../src/server/adapters/fivedb/catalog.postgres.js";
import { QdrantIndex } from "../src/server/adapters/fivedb/vector.qdrant.js";
import { OpenAIEmbeddings } from "../src/server/services/embeddings.js";

async function main() {
  const postgresUrl = process.env.POSTGRES_URL;
  const vectorDbUrl = process.env.VECTOR_DB_URL;
  const openaiKey = process.env.OPENAI_API_KEY;
  const embeddingModel = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
  const vectorDim = parseInt(process.env.VECTOR_DIM || "1536");

  if (!postgresUrl) {
    console.error("❌ POSTGRES_URL not configured");
    process.exit(1);
  }
  if (!vectorDbUrl) {
    console.error("❌ VECTOR_DB_URL not configured");
    process.exit(1);
  }
  if (!openaiKey) {
    console.error("❌ OPENAI_API_KEY not configured");
    process.exit(1);
  }

  console.log("🚀 Starting product indexing...");
  console.log(`📊 Postgres: ${postgresUrl.replace(/:[^:]*@/, ':***@')}`);
  console.log(`🔍 Qdrant: ${vectorDbUrl}`);
  console.log(`🧠 Embedding model: ${embeddingModel} (${vectorDim}d)`);
  console.log("");

  const catalog = new PostgresCatalog(postgresUrl);
  const embeddings = new OpenAIEmbeddings(embeddingModel, openaiKey);
  const vectorIndex = new QdrantIndex(vectorDbUrl, "products", vectorDim, embeddings);

  // Fetch all products in batches (pagination)
  console.log("📥 Fetching all products from Postgres...");
  let allProducts = [];
  let offset = 0;
  const fetchBatch = 1000;

  while (true) {
    const batch = await catalog.search({ limit: fetchBatch, offset });
    if (batch.length === 0) break;
    allProducts.push(...batch);
    console.log(`  Fetched ${allProducts.length} products...`);
    offset += fetchBatch;
    if (batch.length < fetchBatch) break; // Last batch
  }

  const products = allProducts;
  console.log(`✅ Found ${products.length} total products`);

  if (products.length === 0) {
    console.log("⚠️  No products to index");
    return;
  }

  // Index in batches to avoid rate limits
  const batchSize = 20; // OpenAI rate limit friendly
  const batches = [];
  for (let i = 0; i < products.length; i += batchSize) {
    batches.push(products.slice(i, i + batchSize));
  }

  console.log(`🔄 Indexing ${batches.length} batches of ${batchSize} products...`);

  let indexed = 0;
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    try {
      await vectorIndex.upsertProducts(batch);
      indexed += batch.length;
      console.log(`  ✓ Batch ${i + 1}/${batches.length} (${indexed}/${products.length} products)`);

      // Rate limit: wait 1 second between batches
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error: any) {
      console.error(`  ✗ Batch ${i + 1} failed:`, error.message);
    }
  }

  console.log("");
  console.log(`✅ Indexing complete! ${indexed}/${products.length} products indexed`);
  console.log("🔍 Vector search is now available for semantic product recommendations");
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
