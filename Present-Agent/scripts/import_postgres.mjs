#!/usr/bin/env node
// Imports data/processed/unified_catalog.json into Postgres
// Requires: npm i pg (user to install in their environment)
// Usage: POSTGRES_URL=... node scripts/import_postgres.mjs [path/to/unified_catalog.json]

import { config as dotenvConfig } from 'dotenv';
import path from 'path';
dotenvConfig({ path: path.join(process.cwd(), '.env.local') });
dotenvConfig({ path: path.join(process.cwd(), '.env') });

import fs from 'fs';

const { POSTGRES_URL } = process.env;
if (!POSTGRES_URL) {
  console.error("POSTGRES_URL env var is required");
  process.exit(1);
}

let Pg; // lazy import to avoid errors if not installed here
try {
  Pg = await import('pg');
} catch (e) {
  console.error("Missing dependency 'pg'. Please run: npm i pg");
  process.exit(1);
}

const DEFAULT_INPUT = path.join(process.cwd(), 'data', 'processed', 'unified_catalog.json');
const input = process.argv[2] || DEFAULT_INPUT;
if (!fs.existsSync(input)) {
  console.error(`Input not found: ${input}`);
  process.exit(1);
}

const raw = fs.readFileSync(input, 'utf8');
const items = JSON.parse(raw);
if (!Array.isArray(items)) {
  console.error("Input must be an array of products");
  process.exit(1);
}

const client = new Pg.Client({ connectionString: POSTGRES_URL });

function asTextArray(arr) {
  if (!Array.isArray(arr)) return '{}';
  // pg parameter array syntax: pass as JS array and rely on driver
  return arr;
}

async function ensureSchema() {
  const schemaSql = fs.readFileSync(path.join(process.cwd(), 'db', 'sql', 'schema.sql'), 'utf8');
  await client.query(schemaSql);
}

async function upsertVendor(name) {
  if (!name) return null;
  const res = await client.query(
    `INSERT INTO vendors(name) VALUES ($1)
     ON CONFLICT(name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [name]
  );
  return res.rows[0].id;
}

async function upsertCategory(name) {
  if (!name) return null;
  const res = await client.query(
    `INSERT INTO categories(name) VALUES ($1)
     ON CONFLICT(name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [name]
  );
  return res.rows[0].id;
}

async function resolveCategoryIdForVendor(vendorName, sourceCategory) {
  // Check mapping first
  if (vendorName && sourceCategory) {
    const mapRes = await client.query(
      `SELECT m.target_category_id AS id
       FROM category_mappings m
       WHERE m.source_vendor = $1 AND m.source_category = $2
       LIMIT 1`,
      [vendorName, sourceCategory]
    );
    if (mapRes.rows.length > 0) return mapRes.rows[0].id;
  }
  // Fallback: upsert by source category name
  return await upsertCategory(sourceCategory);
}

const MATERIAL_SYNONYMS = {
  ceramic: [/\bceramic(s)?\b/i],
  wood: [/\bwood(en)?\b/i, /\boak\b/i, /\bwalnut\b/i],
  leather: [/\bleather\b/i],
  cotton: [/\bcotton\b/i],
  metal: [/\bsteel\b/i, /\baluminum\b/i, /\bmetal\b/i],
};
const VALUE_SYNONYMS = {
  sustainable: [/\b(eco|sustainable|green|earth[- ]?friendly)\b/i],
  handmade: [/\b(hand[- ]?made|artisan(al)?)\b/i],
  local: [/\b(local(ly)?|shop local)\b/i],
  vegan: [/\b(vegan|plant[- ]?based)\b/i],
  luxury: [/\b(luxury|premium)\b/i],
};
const OCCASION_SYNONYMS = {
  birthday: [/\bbirthday\b/i, /\bturning\s+\d+/i],
  anniversary: [/\banniversary\b/i],
  wedding: [/\bwedding\b/i],
  baby: [/\b(baby|newborn|shower)\b/i],
  graduation: [/\bgraduation\b/i],
  housewarming: [/\bhouse[- ]?warming\b/i],
  thank_you: [/\bthank(s| you)\b/i],
  holiday: [/\bholiday\b/i, /\bchristmas\b/i, /\bhanukkah\b/i, /\beid\b/i, /\bdiwali\b/i],
  valentine: [/\bvalentine'?s?\b/i],
  mothers_day: [/\bmother'?s? day\b/i],
  fathers_day: [/\bfather'?s? day\b/i],
};
const RECIPIENT_SYNONYMS = {
  mom: [/\b(mom|mum|mother)\b/i],
  dad: [/\b(dad|father)\b/i],
  partner: [/\b(partner|spouse|wife|husband|boyfriend|girlfriend)\b/i],
  friend: [/\bfriend\b/i],
  colleague: [/\b(colleague|coworker|co[- ]?worker|boss|manager|teammate)\b/i],
  kids: [/\b(kid|child|children|teen|tween)\b/i],
  him: [/\bhim\b/i],
  her: [/\bher\b/i],
};
const INTEREST_SYNONYMS = {
  cooking: [/\b(cook|cooking|chef|kitchen|baking)\b/i],
  fitness: [/\b(fitness|gym|workout|yoga|pilates|running)\b/i],
  tech: [/\b(tech|gadget|smart|bluetooth|usb)\b/i],
  art: [/\b(art|paint|drawing|sketch|craft)\b/i],
  outdoors: [/\b(outdoor|camp|hike|hiking|camping)\b/i],
  travel: [/\b(travel|luggage|passport|trip)\b/i],
  coffee: [/\bcoffee\b/i],
  tea: [/\btea\b/i],
  skincare: [/\b(skincare|skin care|serum|moisturizer)\b/i],
};

function deriveFacetsFromProduct(p) {
  const facets = [];
  const text = `${p.title} ${p.description || ''}`;
  for (const [mat, regs] of Object.entries(MATERIAL_SYNONYMS)) {
    if (regs.some(r => r.test(text))) facets.push({ facet_key: 'material', facet_value: mat, source: 'rules', confidence: 0.7 });
  }
  for (const [val, regs] of Object.entries(VALUE_SYNONYMS)) {
    if (regs.some(r => r.test(text))) facets.push({ facet_key: 'value', facet_value: val, source: 'rules', confidence: 0.7 });
  }
  for (const [occ, regs] of Object.entries(OCCASION_SYNONYMS)) {
    if (regs.some(r => r.test(text))) facets.push({ facet_key: 'occasion', facet_value: occ, source: 'rules', confidence: 0.6 });
  }
  for (const [rec, regs] of Object.entries(RECIPIENT_SYNONYMS)) {
    if (regs.some(r => r.test(text))) facets.push({ facet_key: 'recipient', facet_value: rec, source: 'rules', confidence: 0.6 });
  }
  for (const [intr, regs] of Object.entries(INTEREST_SYNONYMS)) {
    if (regs.some(r => r.test(text))) facets.push({ facet_key: 'interest', facet_value: intr, source: 'rules', confidence: 0.6 });
  }
  // Price band
  const price = Number(p.price || 0);
  if (Number.isFinite(price)) {
    let band = null;
    if (price < 25) band = 'under_25';
    else if (price < 50) band = '25_49';
    else if (price < 100) band = '50_99';
    else if (price < 200) band = '100_199';
    else band = '200_plus';
    facets.push({ facet_key: 'price_band', facet_value: band, source: 'rules', confidence: 1.0 });
  }
  return facets;
}

async function upsertFacets(productId, facets) {
  if (!Array.isArray(facets) || facets.length === 0) return;
  for (const f of facets) {
    try {
      await client.query(
        `INSERT INTO product_facets(product_id, facet_key, facet_value, source, confidence)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (product_id, facet_key, facet_value) DO NOTHING`,
        [productId, f.facet_key, f.facet_value, f.source || 'rules', f.confidence || 1.0]
      );
    } catch {}
  }
}

async function upsertProduct(p, vendorId, categoryId) {
  await client.query(
    `INSERT INTO products(
      id, vendor_id, category_id, source_website, handle, sku, title, description,
      price, currency, available, image_url, product_url, tags, attributes
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,
      $9,$10,$11,$12,$13,$14,$15
    )
    ON CONFLICT(id) DO UPDATE SET
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
      attributes = EXCLUDED.attributes
    `,
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
      p.currency || 'USD',
      !!p.available,
      p.imageUrl || null,
      p.productUrl,
      asTextArray(p.tags || []),
      p.attributes || {},
    ]
  );
  // Also relate to additional categories table (at least the primary one)
  if (categoryId) {
    try {
      await client.query(
        `INSERT INTO product_categories(product_id, category_id)
         VALUES ($1,$2)
         ON CONFLICT (product_id, category_id) DO NOTHING`,
        [String(p.id), categoryId]
      );
    } catch {}
  }
}

async function run() {
  console.log(`Connecting to Postgres: ${POSTGRES_URL}`);
  await client.connect();
  await client.query('BEGIN');
  try {
    await ensureSchema();
    // cache vendor/category ids to minimize queries
    const vcache = new Map();
    const ccache = new Map();
    let inserted = 0;
    for (const p of items) {
      const vname = p.vendor || null;
      const cname = p.category || null;
      let vid = null, cid = null;
      if (vname) {
        vid = vcache.get(vname);
        if (!vid) { vid = await upsertVendor(vname); vcache.set(vname, vid); }
      }
      if (cname) {
        const cacheKey = `${vname || ''}::${cname}`;
        cid = ccache.get(cacheKey);
        if (!cid) {
          cid = await resolveCategoryIdForVendor(vname || '', cname);
          ccache.set(cacheKey, cid);
        }
      }
      await upsertProduct(p, vid, cid);
      // Enrich with rule-based facets (lightweight)
      try { await upsertFacets(String(p.id), deriveFacetsFromProduct(p)); } catch {}
      inserted++;
      if (inserted % 500 === 0) console.log(`Upserted ${inserted} products...`);
    }
    await client.query('COMMIT');
    console.log(`Imported ${inserted} products.`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Import failed:', e);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
