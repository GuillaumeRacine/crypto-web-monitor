#!/usr/bin/env node
// Suggest categories for products using a lightweight bag-of-words centroid classifier.
// No external network required. Writes to category_suggestions with status 'pending'.
// Usage:
//   POSTGRES_URL=... node scripts/suggest_categories.mjs [--threshold 0.55] [--limit 1000]

import { config as dotenvConfig } from 'dotenv';
import path from 'path';
dotenvConfig({ path: path.join(process.cwd(), '.env.local') });
dotenvConfig({ path: path.join(process.cwd(), '.env') });

const args = process.argv.slice(2);
function argVal(flag, def) {
  const i = args.indexOf(flag);
  if (i >= 0 && args[i+1]) return args[i+1];
  return def;
}
const THRESH = Number(argVal('--threshold', '0.55'));
const LIMIT = Number(argVal('--limit', '100000'));

const { POSTGRES_URL } = process.env;
if (!POSTGRES_URL) {
  console.error('POSTGRES_URL env var is required');
  process.exit(1);
}

let Pg;
try { Pg = await import('pg'); } catch (e) { console.error("Missing dependency 'pg'. Please run: npm i pg"); process.exit(1); }
const client = new Pg.Client({ connectionString: POSTGRES_URL });

function normalize(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const DIM = 4096;
function hashToken(t) {
  // djb2
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = ((h << 5) + h) + t.charCodeAt(i);
  if (h < 0) h = ~h + 1;
  return h % DIM;
}

function vecFrom(text) {
  const v = new Float32Array(DIM);
  const tokens = normalize(text).split(' ').filter(Boolean);
  for (const tok of tokens) {
    const idx = hashToken(tok);
    v[idx] += 1;
  }
  // L2 normalize
  let norm = 0;
  for (let i = 0; i < DIM; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < DIM; i++) v[i] /= norm;
  return v;
}

function addInPlace(a, b) {
  for (let i = 0; i < DIM; i++) a[i] += b[i];
}

function scaleInPlace(a, s) {
  for (let i = 0; i < DIM; i++) a[i] *= s;
}

function cosine(a, b) {
  let dot = 0;
  for (let i = 0; i < DIM; i++) dot += a[i] * b[i];
  return dot;
}

async function fetchLabeledProducts(limit = 20000) {
  const sql = `
    SELECT p.id, p.title, p.description, p.category_id, c.name AS category
    FROM products p
    JOIN categories c ON c.id = p.category_id
    WHERE p.category_id IS NOT NULL
    LIMIT $1`;
  const r = await client.query(sql, [limit]);
  return r.rows;
}

async function fetchUnlabeledProducts(limit = 20000) {
  const sql = `
    SELECT p.id, p.title, p.description
    FROM products p
    WHERE p.category_id IS NULL
    LIMIT $1`;
  const r = await client.query(sql, [limit]);
  return r.rows;
}

async function ensureSuggestion(productId, catId, confidence) {
  await client.query(
    `INSERT INTO category_suggestions(product_id, suggested_category_id, confidence, status, model_version)
     VALUES ($1,$2,$3,'pending',$4)
     ON CONFLICT DO NOTHING`,
    [productId, catId, confidence, 'bow-centroid:v1']
  );
}

async function buildCentroids(examples) {
  const sums = new Map(); // catId -> Float32Array
  const counts = new Map();
  for (const row of examples) {
    const text = `${row.title || ''} ${row.description || ''}`;
    const v = vecFrom(text);
    const key = String(row.category_id);
    let acc = sums.get(key);
    if (!acc) { acc = new Float32Array(DIM); sums.set(key, acc); counts.set(key, 0); }
    addInPlace(acc, v);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  // average and normalize
  for (const [k, acc] of sums.entries()) {
    const n = counts.get(k) || 1;
    scaleInPlace(acc, 1 / n);
    // L2 normalize
    let norm = 0; for (let i = 0; i < DIM; i++) norm += acc[i]*acc[i];
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < DIM; i++) acc[i] /= norm;
  }
  return sums; // catId -> centroid vec
}

async function main() {
  await client.connect();
  try {
    console.log(`[suggest] Loading labeled examples...`);
    const labeled = await fetchLabeledProducts(LIMIT);
    if (labeled.length === 0) {
      console.log('[suggest] No labeled products found; cannot build centroids.');
      return;
    }
    console.log(`[suggest] Building centroids from ${labeled.length} examples...`);
    const centroids = await buildCentroids(labeled);
    console.log(`[suggest] Loading unlabeled products...`);
    const candidates = await fetchUnlabeledProducts(LIMIT);
    if (candidates.length === 0) {
      console.log('[suggest] No unlabeled products found.');
      return;
    }
    console.log(`[suggest] Scoring ${candidates.length} candidates...`);
    let suggested = 0;
    for (const row of candidates) {
      const text = `${row.title || ''} ${row.description || ''}`;
      const v = vecFrom(text);
      let bestCat = null; let bestScore = -1;
      for (const [catId, cVec] of centroids.entries()) {
        const s = cosine(v, cVec);
        if (s > bestScore) { bestScore = s; bestCat = catId; }
      }
      if (bestCat && bestScore >= THRESH) {
        await ensureSuggestion(row.id, Number(bestCat), Number(bestScore.toFixed(3)));
        suggested++;
      }
    }
    console.log(`[suggest] Wrote ${suggested} suggestions (threshold=${THRESH}).`);
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

