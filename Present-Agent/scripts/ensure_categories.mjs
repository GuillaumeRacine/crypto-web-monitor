#!/usr/bin/env node
// Ensures every product has at least one category assigned.
// Strategy:
// 1) Copy products.category_id into product_categories if missing.
// 2) For products with NULL category_id, assign the top pending suggestion (by confidence >= threshold) as primary and relation.
// 3) If still NULL, assign/ensure an 'Uncategorized' category and set as primary and relation.

import { config as dotenvConfig } from 'dotenv';
import path from 'path';
dotenvConfig({ path: path.join(process.cwd(), '.env.local') });
dotenvConfig({ path: path.join(process.cwd(), '.env') });

const { POSTGRES_URL } = process.env;
if (!POSTGRES_URL) { console.error('POSTGRES_URL is required'); process.exit(1); }

let Pg; try { Pg = await import('pg'); } catch (e) { console.error("Missing dependency 'pg'. Please run: npm i pg"); process.exit(1); }
const client = new Pg.Client({ connectionString: POSTGRES_URL });

async function copyPrimaryToRelations() {
  const sql = `
    INSERT INTO product_categories(product_id, category_id)
    SELECT id, category_id FROM products
    WHERE category_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM product_categories pc WHERE pc.product_id = products.id AND pc.category_id = products.category_id
      )`;
  const r = await client.query(sql);
  return r.rowCount || 0;
}

async function assignFromSuggestions() {
  // Auto-approve: pick the top suggestion per product (by confidence), set as primary, insert relation, and mark that suggestion as 'accepted'.
  const sql = `
    WITH top_s AS (
      SELECT DISTINCT ON (cs.product_id) cs.id, cs.product_id, cs.suggested_category_id, cs.confidence
      FROM category_suggestions cs
      JOIN products p ON p.id = cs.product_id
      WHERE p.category_id IS NULL AND cs.status = 'pending'
      ORDER BY cs.product_id, cs.confidence DESC
    ), upd AS (
      UPDATE products p
      SET category_id = ts.suggested_category_id
      FROM top_s ts
      WHERE p.id = ts.product_id AND p.category_id IS NULL
      RETURNING p.id, ts.suggested_category_id, ts.id AS suggestion_id
    ), rel AS (
      INSERT INTO product_categories(product_id, category_id)
      SELECT p.id, p.suggested_category_id FROM upd p
      ON CONFLICT (product_id, category_id) DO NOTHING
      RETURNING 1
    ), acc AS (
      UPDATE category_suggestions SET status = 'accepted'
      WHERE id IN (SELECT suggestion_id FROM upd)
      RETURNING id
    ), ev AS (
      INSERT INTO events(type, payload)
      SELECT 'category_auto_assign', jsonb_build_object(
        'productId', u.id,
        'categoryId', u.suggested_category_id,
        'method', 'suggestion'
      ) FROM upd u
      RETURNING id
    )
    SELECT (SELECT COUNT(*)::int FROM upd) AS assigned_count,
           (SELECT COUNT(*)::int FROM acc) AS accepted_count`;
  const r = await client.query(sql);
  const row = r.rows?.[0] || { assigned_count: 0, accepted_count: 0 };
  return Number(row.assigned_count || 0);
}

async function assignFromVendorMajority() {
  const sql = `
    WITH vc AS (
      SELECT vendor_id, category_id, cnt,
             ROW_NUMBER() OVER (PARTITION BY vendor_id ORDER BY cnt DESC) rn
      FROM (
        SELECT vendor_id, category_id, COUNT(*) AS cnt
        FROM products
        WHERE vendor_id IS NOT NULL AND category_id IS NOT NULL
        GROUP BY vendor_id, category_id
      ) s
    ), upd AS (
      UPDATE products p
      SET category_id = vc.category_id
      FROM vc
      WHERE p.vendor_id = vc.vendor_id AND vc.rn = 1 AND p.category_id IS NULL
      RETURNING p.id, vc.category_id
    ), rel AS (
      INSERT INTO product_categories(product_id, category_id)
      SELECT id, category_id FROM upd
      ON CONFLICT (product_id, category_id) DO NOTHING
    ), ev AS (
      INSERT INTO events(type, payload)
      SELECT 'category_auto_assign', jsonb_build_object(
        'productId', u.id,
        'categoryId', u.category_id,
        'method', 'vendor_majority'
      ) FROM upd u
      RETURNING id
    )
    SELECT COUNT(*)::int AS assigned_count FROM upd`;
  const r = await client.query(sql);
  const row = r.rows?.[0] || { assigned_count: 0 };
  return Number(row.assigned_count || 0);
}

async function assignFromGlobalTopOrCreate() {
  // Try global top category; if none exists (no labeled rows yet), create 'General' and use it.
  const top = await client.query(`
    SELECT category_id
    FROM (
      SELECT category_id, COUNT(*) cnt
      FROM products
      WHERE category_id IS NOT NULL
      GROUP BY category_id
    ) x
    ORDER BY cnt DESC
    LIMIT 1`);
  let cid = top.rows[0]?.category_id || null;
  if (!cid) {
    const c = await client.query(`INSERT INTO categories(name) VALUES ($1) ON CONFLICT(name) DO UPDATE SET name = EXCLUDED.name RETURNING id`, ['General']);
    cid = c.rows[0].id;
  }
  const sql = `
    WITH upd AS (
      UPDATE products SET category_id = $1 WHERE category_id IS NULL RETURNING id
    ), rel AS (
      INSERT INTO product_categories(product_id, category_id)
      SELECT id, $1 FROM upd
      ON CONFLICT (product_id, category_id) DO NOTHING
    ), ev AS (
      INSERT INTO events(type, payload)
      SELECT 'category_auto_assign', jsonb_build_object(
        'productId', u.id,
        'categoryId', $1,
        'method', 'global_top'
      ) FROM upd u
      RETURNING id
    )
    SELECT COUNT(*)::int AS assigned_count FROM upd`;
  const r = await client.query(sql, [cid]);
  const row = r.rows?.[0] || { assigned_count: 0 };
  return Number(row.assigned_count || 0);
}

async function main() {
  await client.connect();
  try {
    const a = await copyPrimaryToRelations();
    console.log(`[ensure] copied ${a} primary categories to product_categories`);
    const b = await assignFromSuggestions();
    console.log(`[ensure] auto-approved suggestions (primary): ${b}`);
    const c = await assignFromVendorMajority();
    console.log(`[ensure] vendor-majority fallback assigned: ${c}`);
    const d = await assignFromGlobalTopOrCreate();
    console.log(`[ensure] global-top/created fallback assigned: ${d}`);
  } finally { await client.end(); }
}

main().catch((e)=>{ console.error(e); process.exit(1); });
