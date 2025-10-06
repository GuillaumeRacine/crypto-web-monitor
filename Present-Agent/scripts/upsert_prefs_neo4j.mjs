#!/usr/bin/env node
// Upsert recipient preference graph (LIKES Category/Vendor) into Neo4j.
// Usage:
//   node scripts/upsert_prefs_neo4j.mjs path/to/preferences.json
// Env: NEO4J_URL, NEO4J_USER, NEO4J_PASSWORD, optional NEO4J_DATABASE

import { config as dotenvConfig } from 'dotenv';
import path from 'path';
dotenvConfig({ path: path.join(process.cwd(), '.env.local') });
dotenvConfig({ path: path.join(process.cwd(), '.env') });

import fs from 'fs';
import neo4j from 'neo4j-driver';

const { NEO4J_URL, NEO4J_USER, NEO4J_PASSWORD, NEO4J_DATABASE } = process.env;
if (!NEO4J_URL || !NEO4J_USER || !NEO4J_PASSWORD) {
  console.error('NEO4J_URL, NEO4J_USER, and NEO4J_PASSWORD are required');
  process.exit(1);
}

const input = process.argv[2];
if (!input) {
  console.error('Please provide a JSON file path. Example item: {"recipientId":"r1","likes":{"categories":["Books"],"vendors":["Acme"]}}');
  process.exit(1);
}
if (!fs.existsSync(input)) {
  console.error(`File not found: ${input}`);
  process.exit(1);
}

const raw = fs.readFileSync(input, 'utf8');
const items = JSON.parse(raw);
if (!Array.isArray(items)) {
  console.error('Input must be an array of preference objects');
  process.exit(1);
}

const driver = neo4j.driver(NEO4J_URL, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
const session = driver.session({ database: NEO4J_DATABASE });

async function upsertOne(item) {
  const rid = String(item.recipientId || '');
  if (!rid) return;
  const likes = item.likes || {};
  const categories = Array.isArray(likes.categories) ? likes.categories : [];
  const vendors = Array.isArray(likes.vendors) ? likes.vendors : [];
  const tx = session.beginTransaction();
  try {
    await tx.run(`MERGE (r:Recipient {id: $rid}) ON CREATE SET r.createdAt = timestamp()`, { rid });
    for (const c of categories) {
      await tx.run(
        `MERGE (r:Recipient {id: $rid})
         MERGE (c:Category {name: $c})
         MERGE (r)-[:LIKES]->(c)`,
        { rid, c }
      );
    }
    for (const v of vendors) {
      await tx.run(
        `MERGE (r:Recipient {id: $rid})
         MERGE (v:Vendor {name: $v})
         MERGE (r)-[:LIKES]->(v)`,
        { rid, v }
      );
    }
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

async function run() {
  let ok = 0;
  for (const it of items) {
    await upsertOne(it);
    ok++;
  }
  await session.close();
  await driver.close();
  console.log(`Upserted preferences for ${ok} recipients`);
}

run().catch(async (e) => {
  console.error(e);
  await session.close().catch(() => {});
  await driver.close().catch(() => {});
  process.exit(1);
});

