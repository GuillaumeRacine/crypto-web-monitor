#!/usr/bin/env tsx
/**
 * Index a single product by ID
 * Usage: npx tsx scripts/index-single-product.ts <product-id>
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
  const productId = process.argv[2] || "8739924738283"; // Lure Making Kit by default

  const postgresUrl = process.env.POSTGRES_URL!;
  const vectorDbUrl = process.env.VECTOR_DB_URL!;
  const openaiKey = process.env.OPENAI_API_KEY!;

  const catalog = new PostgresCatalog(postgresUrl);
  const embeddings = new OpenAIEmbeddings("text-embedding-3-small", openaiKey);
  const vectorIndex = new QdrantIndex(vectorDbUrl, "products", 1536, embeddings);

  console.log(`📦 Fetching product ${productId}...`);
  const product = await catalog.getById(productId);

  if (!product) {
    console.error(`❌ Product ${productId} not found`);
    process.exit(1);
  }

  console.log(`✅ Found: ${product.title}`);
  console.log(`   Category: ${product.category}`);
  console.log(`   Price: $${product.price}`);
  console.log("");
  console.log("🔄 Indexing with embeddings...");

  await vectorIndex.upsertProducts([product]);

  console.log("✅ Successfully indexed!");
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
