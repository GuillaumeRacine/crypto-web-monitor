#!/usr/bin/env node
// One-command local dev: start API + Web, ingest data, and (optionally) import Postgres and index Qdrant.
// Usage: npm run dev:all
// Respects env in .env.local/.env via dotenv.

import { config as dotenvConfig } from 'dotenv';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';

dotenvConfig({ path: path.join(process.cwd(), '.env.local') });
dotenvConfig({ path: path.join(process.cwd(), '.env') });

const PORT = process.env.PORT || '3001';
const WEB_PORT = process.env.WEB_PORT || '3000';
const MODE = 'five-db';

function wait(ms) { return new Promise((res) => setTimeout(res, ms)); }

async function waitForApi(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch {}
    await wait(500);
  }
  throw new Error(`Timed out waiting for API at ${url}`);
}

function run(cmd, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env } });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve(0) : reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`)));
  });
}

async function compose(args) {
  // Prefer Docker Compose v2 (`docker compose`); fallback to v1 (`docker-compose`)
  try {
    await run('docker', ['compose', 'version']);
    return run('docker', ['compose', ...args]);
  } catch {
    return run('docker-compose', args);
  }
}

async function ensureUnifiedCatalog() {
  const outFile = path.join(process.cwd(), 'data', 'processed', 'unified_catalog.json');
  if (fs.existsSync(outFile)) return outFile;
  console.log('[dev:all] running ingest to build catalog...');
  await run('npm', ['run', 'ingest']);
  if (!fs.existsSync(outFile)) throw new Error('unified_catalog.json not found after ingest');
  return outFile;
}

async function ingestToApi(apiBase, max = Infinity, batchSize = 500) {
  const file = await ensureUnifiedCatalog();
  const items = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`[dev:all] ingesting ${Math.min(items.length, max)} products to API in batches of ${batchSize}...`);
  let sent = 0;
  while (sent < items.length && sent < max) {
    const slice = items.slice(sent, Math.min(sent + batchSize, items.length, max));
    const res = await fetch(`${apiBase}/api/ingest`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ products: slice }) });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`/api/ingest failed: ${res.status} ${t}`);
    }
    const j = await res.json().catch(() => ({}));
    sent += slice.length;
    console.log(`[dev:all] ingested ${sent}/${Math.min(items.length, max)} (${j?.ingested ?? slice.length})`);
  }
}

async function main() {
  // Ensure core services are up in Docker (idempotent)
  try {
    console.log('[dev:all] ensuring Docker services (postgres, neo4j, qdrant, redis, redpanda)');
    await compose(['up', '-d', 'postgres', 'neo4j', 'qdrant', 'redis', 'redpanda']);
  } catch (e) {
    console.warn('[dev:all] Docker compose failed or not available; continuing if services already running');
  }
  console.log(`[dev:all] starting API on :${PORT} (${MODE} mode)`);
  const apiProc = spawn('npm', ['run', 'dev'], { stdio: 'inherit', env: { ...process.env, PORT, MODE } });

  // Clean exit handling
  const onExit = () => { try { apiProc.kill(); webProc?.kill(); } catch {} process.exit(0); };
  process.on('SIGINT', onExit); process.on('SIGTERM', onExit);

  // Wait for API
  await waitForApi(`http://localhost:${PORT}/api/search`);
  console.log('[dev:all] API is up');

  if (process.env.POSTGRES_URL) {
    console.log('[dev:all] five-db detected; importing to Postgres');
    await run('npm', ['run', 'ingest']);
    await run('npm', ['run', 'import:postgres']);
    // Auto-suggest and auto-approve primary categories so products always have a category
    try {
      console.log('[dev:all] suggesting categories');
      await run('npm', ['run', 'suggest:categories']);
    } catch (e) {
      console.warn('[dev:all] suggest:categories failed (continuing):', e.message || e);
    }
    try {
      console.log('[dev:all] ensuring categories (auto-approve primary)');
      await run('npm', ['run', 'ensure:categories']);
    } catch (e) {
      console.warn('[dev:all] ensure:categories failed (continuing):', e.message || e);
    }
    if (process.env.VECTOR_DB_URL && process.env.OPENAI_API_KEY) {
      console.log('[dev:all] indexing Qdrant');
      try {
        await run('npm', ['run', 'index:qdrant']);
      } catch (e) {
        console.warn('[dev:all] Qdrant indexing failed (continuing):', e.message);
      }
    } else {
      console.log('[dev:all] skipping Qdrant indexing (VECTOR_DB_URL or OPENAI_API_KEY missing)');
    }
  }

  console.log(`[dev:all] starting Web on :${WEB_PORT}`);
  var webProc = spawn('npm', ['run', 'web:dev'], { stdio: 'inherit', env: { ...process.env, PORT: WEB_PORT } });

  // Try to open the browser
  const url = `http://localhost:${WEB_PORT}`;
  try {
    const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    spawn(opener, [url], { stdio: 'ignore', shell: true });
  } catch {}

  // Hold the process open while children run
  await new Promise(() => {});
}

main().catch((e) => { console.error(e); process.exit(1); });
