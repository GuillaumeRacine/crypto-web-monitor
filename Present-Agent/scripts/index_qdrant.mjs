#!/usr/bin/env node
// Index all products from Postgres into Qdrant using OpenAI embeddings.
// Env: POSTGRES_URL, VECTOR_DB_URL, OPENAI_API_KEY
// Optional: MODEL_NAME (default text-embedding-3-small), VECTOR_DIM

import { config as dotenvConfig } from 'dotenv';
import path from 'path';
dotenvConfig({ path: path.join(process.cwd(), '.env.local') });
dotenvConfig({ path: path.join(process.cwd(), '.env') });

import fs from 'fs';

const { POSTGRES_URL, VECTOR_DB_URL, OPENAI_API_KEY } = process.env;
const MODEL_NAME = process.env.EMBEDDING_MODEL || process.env.MODEL_NAME || 'text-embedding-3-small';
const VECTOR_DIM = Number(process.env.VECTOR_DIM || 1536);

if (!POSTGRES_URL) { console.error('POSTGRES_URL is required'); process.exit(1); }
if (!VECTOR_DB_URL) { console.error('VECTOR_DB_URL is required'); process.exit(1); }
if (!OPENAI_API_KEY) { console.error('OPENAI_API_KEY is required'); process.exit(1); }

let Pg;
try { Pg = await import('pg'); } catch {
  console.error("Missing dependency 'pg'. Please run: npm i pg");
  process.exit(1);
}

const { Client } = Pg;

async function embed(text) {
  const input = (text || '').slice(0, 8000);
  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: MODEL_NAME, input }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`Embeddings failed: ${resp.status} ${detail}`);
  }
  const json = await resp.json();
  return json?.data?.[0]?.embedding;
}

async function ensureCollection(name) {
  const u = new URL(`/collections/${encodeURIComponent(name)}`, VECTOR_DB_URL);
  const resp = await fetch(u.toString(), {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vectors: { size: VECTOR_DIM, distance: 'Cosine' } }),
  });
  if (!resp.ok && resp.status !== 409) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`Qdrant ensure failed: ${resp.status} ${detail}`);
  }
}

async function upsertPoints(collection, points) {
  const u = new URL(`/collections/${encodeURIComponent(collection)}/points`, VECTOR_DB_URL);
  const resp = await fetch(u.toString(), {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ points }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`Qdrant upsert failed: ${resp.status} ${detail}`);
  }
}

function productText(p) {
  const parts = [p.title, p.description || '', p.vendor || '', p.category || '', (p.tags || []).join(' ')];
  return parts.filter(Boolean).join(' \n ');
}

async function run() {
  const collection = 'products';
  await ensureCollection(collection);
  const client = new Client({ connectionString: POSTGRES_URL });
  await client.connect();
  console.log('Connected to Postgres. Fetching products...');
  const res = await client.query(`
    SELECT p.*, v.name AS vendor_name, c.name AS category_name
    FROM products p
    LEFT JOIN vendors v ON v.id = p.vendor_id
    LEFT JOIN categories c ON c.id = p.category_id
  `);
  console.log(`Embedding and indexing ${res.rows.length} products to Qdrant...`);
  const batchSize = 64;
  for (let i = 0; i < res.rows.length; i += batchSize) {
    const batch = res.rows.slice(i, i + batchSize);
    const points = [];
    for (const row of batch) {
      const p = {
        id: String(row.id),
        title: row.title,
        description: row.description,
        vendor: row.vendor_name,
        category: row.category_name,
        price: Number(row.price),
        currency: row.currency,
        available: !!row.available,
        productUrl: row.product_url,
        tags: row.tags || [],
      };
      const vec = await embed(productText(p));
      points.push({
        id: p.id,
        vector: vec,
        payload: {
          id: p.id, title: p.title, price: p.price, currency: p.currency || 'USD',
          vendor: p.vendor || null, category: p.category || null, available: p.available,
          product_url: p.productUrl, tags: p.tags,
        },
      });
    }
    await upsertPoints(collection, points);
    console.log(`Indexed ${Math.min(i + batchSize, res.rows.length)}/${res.rows.length}`);
  }
  await client.end();
  console.log('Done.');
}

run().catch((e) => { console.error(e); process.exit(1); });
