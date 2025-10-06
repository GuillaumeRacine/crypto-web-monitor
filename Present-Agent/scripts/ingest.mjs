#!/usr/bin/env node
// Ingests raw product JSON files and outputs a unified catalog.
// Usage:
//   node scripts/ingest.mjs [file1.json file2.json ...]
// Without args, it scans data/raw/*.json and a few known root files.

import { config as dotenvConfig } from 'dotenv';
import path from 'path';
dotenvConfig({ path: path.join(process.cwd(), '.env.local') });
dotenvConfig({ path: path.join(process.cwd(), '.env') });

import fs from 'fs';

const ROOT = process.cwd();

function readJsonSafe(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Failed to read ${file}:`, e.message);
    return null;
  }
}

function stripHtml(s) {
  return (s || '').replace(/<[^>]*>/g, '').trim();
}

function toStrId(x) {
  if (x === null || x === undefined) return '';
  return String(x);
}

function hashString(s) {
  // simple djb2
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

function guessCurrency(website) {
  if (!website) return 'USD';
  if (website.includes('.ca')) return 'CAD';
  return 'USD';
}

function slugify(s) {
  return (s || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function deriveTags({ title, vendor, category, handle }) {
  const tags = new Set();
  if (vendor) tags.add(String(vendor).toLowerCase());
  if (category) tags.add(slugify(category));
  if (handle) tags.add(slugify(handle));
  const words = (title || '').toLowerCase().split(/[^a-z0-9]+/g).filter(w => w.length >= 4);
  for (const w of words.slice(0, 5)) tags.add(w);
  return Array.from(tags).filter(Boolean);
}

function normalizeItem(item, source) {
  // Source fields may be capitalized or accented
  const website = item.Website || item.website || '';
  const productUrl = item.url || item.product_url || '';
  const title = item.title || '';
  const description = stripHtml(item.Description || item.description || '');
  const vendor = item.vendor != null ? String(item.vendor) : null;
  const price = typeof item.price === 'number' ? item.price : Number(item.price || 0);
  const available = typeof item.available === 'boolean' ? item.available : !!item.availabilty;
  const category = item['catégories'] || item.categories || item.category || null;
  const imageUrl = item.image || item.image_url || null;
  const handle = item.handle || null;
  const sku = item.sku === '' ? null : (item.sku != null ? String(item.sku) : null);
  const currency = item.currency || guessCurrency(website);

  let id = toStrId(item.id);
  if (!id || id === '0') {
    id = hashString(`${productUrl}|${title}|${vendor || ''}`);
  }

  const normalized = {
    id,
    sourceWebsite: website || source || '',
    handle,
    sku,
    title,
    description: description || null,
    vendor,
    price: isFinite(price) ? price : 0,
    currency,
    available: !!available,
    category: category || null,
    imageUrl,
    productUrl,
    tags: deriveTags({ title, vendor, category, handle }),
    attributes: {}
  };
  return normalized;
}

function scanDefaultFiles() {
  const defaults = [];
  // known root files
  ['Gift & special events products (1).json', 'Produits variés.json'].forEach((f) => {
    const p = path.join(ROOT, f);
    if (fs.existsSync(p)) defaults.push(p);
  });
  // data/raw/*.json
  const rawDir = path.join(ROOT, 'data', 'raw');
  if (fs.existsSync(rawDir)) {
    for (const f of fs.readdirSync(rawDir)) {
      if (f.toLowerCase().endsWith('.json')) defaults.push(path.join(rawDir, f));
    }
  }
  return defaults;
}

function main() {
  const args = process.argv.slice(2);
  const files = args.length ? args : scanDefaultFiles();
  if (!files.length) {
    console.error('No input files found. Pass JSON files or place them under data/raw/.');
    process.exit(1);
  }

  const unified = [];
  let total = 0;
  for (const file of files) {
    const data = readJsonSafe(file);
    if (!data) continue;
    if (!Array.isArray(data)) {
      console.warn(`Skipping ${file}: not an array`);
      continue;
    }
    for (const item of data) {
      const n = normalizeItem(item, path.basename(file));
      unified.push(n);
    }
    total += data.length;
  }

  // Write outputs
  const outDir = path.join(ROOT, 'data', 'processed');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'unified_catalog.json');
  fs.writeFileSync(outFile, JSON.stringify(unified, null, 2));

  // Basic stats
  const stats = {
    inputs: files,
    total_input_items: total,
    total_unified_items: unified.length,
    empty_descriptions: unified.filter(x => !x.description).length,
    empty_skus: unified.filter(x => !x.sku).length,
    empty_categories: unified.filter(x => !x.category).length,
    currencies: Object.fromEntries(unified.reduce((m, x) => m.set(x.currency, (m.get(x.currency) || 0) + 1), new Map())),
  };
  fs.writeFileSync(path.join(outDir, 'stats.json'), JSON.stringify(stats, null, 2));

  console.log(`Unified ${unified.length} products → ${path.relative(ROOT, outFile)}`);
  console.log(`Stats written → ${path.relative(ROOT, path.join(outDir, 'stats.json'))}`);
}

main();
