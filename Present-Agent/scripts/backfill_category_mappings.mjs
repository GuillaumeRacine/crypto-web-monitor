#!/usr/bin/env node
// Applies existing category_mappings to already-imported products without re-ingesting.
// Usage: POSTGRES_URL=... node scripts/backfill_category_mappings.mjs

import { config as dotenvConfig } from 'dotenv';
import path from 'path';
dotenvConfig({ path: path.join(process.cwd(), '.env.local') });
dotenvConfig({ path: path.join(process.cwd(), '.env') });

const { POSTGRES_URL } = process.env;
if (!POSTGRES_URL) {
  console.error('POSTGRES_URL env var is required');
  process.exit(1);
}

let Pg;
try { Pg = await import('pg'); } catch (e) { console.error("Missing dependency 'pg'. Please run: npm i pg"); process.exit(1); }
const client = new Pg.Client({ connectionString: POSTGRES_URL });

async function countByMapping() {
  const sql = `
    SELECT m.source_vendor, m.source_category, c2.name AS target, COUNT(*)::bigint AS affected
    FROM products p
    JOIN vendors v ON v.id = p.vendor_id
    JOIN categories c ON c.id = p.category_id
    JOIN category_mappings m ON m.source_vendor = v.name AND m.source_category = c.name
    JOIN categories c2 ON c2.id = m.target_category_id
    WHERE p.category_id IS DISTINCT FROM m.target_category_id
    GROUP BY 1,2,3
    ORDER BY 1,2`;
  const r = await client.query(sql);
  return r.rows;
}

async function applyMappings() {
  const sql = `
    WITH upd AS (
      UPDATE products p
      SET category_id = m.target_category_id
      FROM vendors v, categories c, category_mappings m
      WHERE p.vendor_id = v.id
        AND p.category_id = c.id
        AND m.source_vendor = v.name
        AND m.source_category = c.name
        AND m.target_category_id IS NOT NULL
        AND (p.category_id IS DISTINCT FROM m.target_category_id)
      RETURNING p.id AS product_id
    )
    SELECT COUNT(*)::bigint AS updated FROM upd`;
  const r = await client.query(sql);
  return Number(r.rows?.[0]?.updated || 0);
}

async function main() {
  await client.connect();
  try {
    console.log('[backfill] Checking pending mapping applications...');
    const pending = await countByMapping();
    if (pending.length === 0) {
      console.log('[backfill] Nothing to update. Exiting.');
      return;
    }
    console.table(pending);
    console.log('[backfill] Applying category mappings to products...');
    const n = await applyMappings();
    console.log(`[backfill] Updated ${n} product rows.`);
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

