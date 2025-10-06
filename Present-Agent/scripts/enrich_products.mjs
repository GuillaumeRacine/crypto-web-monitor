#!/usr/bin/env node
// Enrich existing products with rule-based facets (occasion, recipient, interest, materials, values, price_band).
// Usage: POSTGRES_URL=... node scripts/enrich_products.mjs [--limit 100000]

import { config as dotenvConfig } from 'dotenv';
import path from 'path';
dotenvConfig({ path: path.join(process.cwd(), '.env.local') });
dotenvConfig({ path: path.join(process.cwd(), '.env') });

const args = process.argv.slice(2);
const LIMIT = Number((() => { const i = args.indexOf('--limit'); return i>=0 && args[i+1] ? args[i+1] : '100000'; })());

const { POSTGRES_URL } = process.env;
if (!POSTGRES_URL) { console.error('POSTGRES_URL is required'); process.exit(1); }

let Pg;
try { Pg = await import('pg'); } catch (e) { console.error("Missing dependency 'pg'. Please run: npm i pg"); process.exit(1); }
const client = new Pg.Client({ connectionString: POSTGRES_URL });

function normalize(s) {
  return (s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
}

const MATERIAL_SYNONYMS = {
  ceramic: [/\bceramic(s)?\b/i], wood: [/\bwood(en)?\b/i, /\boak\b/i, /\bwalnut\b/i], leather: [/\bleather\b/i], cotton: [/\bcotton\b/i], metal: [/\bsteel\b/i, /\baluminum\b/i, /\bmetal\b/i],
};
const VALUE_SYNONYMS = {
  sustainable: [/\b(eco|sustainable|green|earth[- ]?friendly)\b/i], handmade: [/\b(hand[- ]?made|artisan(al)?)\b/i], local: [/\b(local(ly)?|shop local)\b/i], vegan: [/\b(vegan|plant[- ]?based)\b/i], luxury: [/\b(luxury|premium)\b/i],
};
const OCCASION_SYNONYMS = {
  birthday: [/\bbirthday\b/i, /\bturning\s+\d+/i], anniversary: [/\banniversary\b/i], wedding: [/\bwedding\b/i], baby: [/\b(baby|newborn|shower)\b/i], graduation: [/\bgraduation\b/i], housewarming: [/\bhouse[- ]?warming\b/i], thank_you: [/\bthank(s| you)\b/i], holiday: [/\bholiday\b/i, /\bchristmas\b/i, /\bhanukkah\b/i, /\beid\b/i, /\bdiwali\b/i], valentine: [/\bvalentine'?s?\b/i], mothers_day: [/\bmother'?s? day\b/i], fathers_day: [/\bfather'?s? day\b/i],
};
const RECIPIENT_SYNONYMS = {
  mom: [/\b(mom|mum|mother)\b/i], dad: [/\b(dad|father)\b/i], partner: [/\b(partner|spouse|wife|husband|boyfriend|girlfriend)\b/i], friend: [/\bfriend\b/i], colleague: [/\b(colleague|coworker|co[- ]?worker|boss|manager|teammate)\b/i], kids: [/\b(kid|child|children|teen|tween)\b/i], him: [/\bhim\b/i], her: [/\bher\b/i],
};
const INTEREST_SYNONYMS = {
  cooking: [/\b(cook|cooking|chef|kitchen|baking)\b/i], fitness: [/\b(fitness|gym|workout|yoga|pilates|running)\b/i], tech: [/\b(tech|gadget|smart|bluetooth|usb)\b/i], art: [/\b(art|paint|drawing|sketch|craft)\b/i], outdoors: [/\b(outdoor|camp|hike|hiking|camping)\b/i], travel: [/\b(travel|luggage|passport|trip)\b/i], coffee: [/\bcoffee\b/i], tea: [/\btea\b/i], skincare: [/\b(skincare|skin care|serum|moisturizer)\b/i],
};

function deriveFacets(p) {
  const facets = [];
  const text = `${p.title || ''} ${p.description || ''}`;
  for (const [mat, regs] of Object.entries(MATERIAL_SYNONYMS)) if (regs.some(r=>r.test(text))) facets.push(['material', mat, 0.7]);
  for (const [val, regs] of Object.entries(VALUE_SYNONYMS)) if (regs.some(r=>r.test(text))) facets.push(['value', val, 0.7]);
  for (const [occ, regs] of Object.entries(OCCASION_SYNONYMS)) if (regs.some(r=>r.test(text))) facets.push(['occasion', occ, 0.6]);
  for (const [rec, regs] of Object.entries(RECIPIENT_SYNONYMS)) if (regs.some(r=>r.test(text))) facets.push(['recipient', rec, 0.6]);
  for (const [intr, regs] of Object.entries(INTEREST_SYNONYMS)) if (regs.some(r=>r.test(text))) facets.push(['interest', intr, 0.6]);
  const price = Number(p.price||0);
  if (Number.isFinite(price)) {
    let band = '200_plus';
    if (price < 25) band = 'under_25'; else if (price < 50) band = '25_49'; else if (price < 100) band = '50_99'; else if (price < 200) band = '100_199';
    facets.push(['price_band', band, 1.0]);
  }
  return facets;
}

async function fetchProducts(limit) {
  const sql = `SELECT id, title, description, price FROM products LIMIT $1`;
  const r = await client.query(sql, [limit]);
  return r.rows;
}

async function upsertFacet(productId, key, value, conf) {
  await client.query(
    `INSERT INTO product_facets(product_id, facet_key, facet_value, source, confidence)
     VALUES ($1,$2,$3,'rules',$4)
     ON CONFLICT (product_id, facet_key, facet_value) DO NOTHING`,
    [productId, key, value, conf]
  );
}

async function main() {
  await client.connect();
  try {
    const rows = await fetchProducts(LIMIT);
    console.log(`[enrich] Processing ${rows.length} products...`);
    let ins = 0;
    for (const p of rows) {
      const f = deriveFacets(p);
      for (const [k,v,c] of f) { await upsertFacet(p.id, k, v, c); ins++; }
    }
    console.log(`[enrich] Upserted ~${ins} facet rows.`);
  } finally {
    await client.end();
  }
}

main().catch((e)=>{ console.error(e); process.exit(1); });

