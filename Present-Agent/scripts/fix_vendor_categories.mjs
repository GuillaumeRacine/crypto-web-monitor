#!/usr/bin/env node
// Fix vendor-specific category issues where pattern matching fails

import pg from 'pg';
import 'dotenv/config';

const POSTGRES_URL = process.env.POSTGRES_URL;
if (!POSTGRES_URL) {
  console.error('[fix] POSTGRES_URL not set');
  process.exit(1);
}

// Vendor-specific overrides (vendor name → canonical category)
const VENDOR_OVERRIDES = {
  'Funeral Collection': 'Flowers & Plants',
  'FRESH FLOWERS': 'Flowers & Plants',
  'FREE DELIVERY': 'Flowers & Plants',
  'Toy Florist': 'Flowers & Plants',
  'Florist | Flower Shop 🌷 Same-Day Delivery | La Belle Fleur': 'Flowers & Plants',
  'David Austin Roses - US': 'Flowers & Plants',
  'David Austin Roses - UK': 'Flowers & Plants',
  'Heirloom Roses': 'Flowers & Plants',
  'Brecks': 'Flowers & Plants',
  'Brecks Canada': 'Flowers & Plants',
  'Dutch Bulbs': 'Flowers & Plants',
  'DutchGrown': 'Flowers & Plants',
  'Afloral': 'Flowers & Plants',
  'BCVC': 'Flowers & Plants',
};

// Product title patterns (regex → canonical category)
const TITLE_PATTERNS = [
  { pattern: /\b(wreath|funeral|casket|spray|sympathy|memorial|condolence)\b/i, canonical: 'Flowers & Plants' },
  { pattern: /\b(roses?|lilies|tulips?|orchids?|bouquet|arrangement|blooms?)\b/i, canonical: 'Flowers & Plants' },
  { pattern: /\b(puzzle|jigsaw)\b/i, canonical: 'Toys & Games' },
  { pattern: /\b(balloon|party|decoration|garland|streamer)\b/i, canonical: 'Party Supplies & Decorations' },
];

async function main() {
  const client = new pg.Client({ connectionString: POSTGRES_URL });
  await client.connect();

  try {
    let totalFixed = 0;

    // Fix by vendor override
    for (const [vendor, canonical] of Object.entries(VENDOR_OVERRIDES)) {
      const { rows: catRows } = await client.query('SELECT id FROM categories WHERE name = $1', [canonical]);
      if (catRows.length === 0) {
        console.log(`[fix] Skipping ${vendor} - category "${canonical}" not found`);
        continue;
      }
      const catId = catRows[0].id;

      const result = await client.query(`
        UPDATE products SET category_id = $1
        WHERE vendor_id IN (SELECT id FROM vendors WHERE name = $2)
      `, [catId, vendor]);

      if (result.rowCount > 0) {
        console.log(`[fix] ${vendor}: ${result.rowCount} → ${canonical}`);
        totalFixed += result.rowCount;
      }
    }

    // Fix by title pattern
    for (const { pattern, canonical } of TITLE_PATTERNS) {
      const { rows: catRows } = await client.query('SELECT id FROM categories WHERE name = $1', [canonical]);
      if (catRows.length === 0) continue;
      const catId = catRows[0].id;

      const { rows: products } = await client.query(`
        SELECT id, title FROM products WHERE title ~* $1
      `, [pattern.source.replace(/\\/g, '\\\\')]);

      if (products.length > 0) {
        const ids = products.map(p => p.id);
        const result = await client.query(`
          UPDATE products SET category_id = $1 WHERE id = ANY($2)
        `, [catId, ids]);

        if (result.rowCount > 0) {
          console.log(`[fix] Pattern "${pattern.source.slice(0, 40)}": ${result.rowCount} → ${canonical}`);
          totalFixed += result.rowCount;
        }
      }
    }

    console.log(`\n[fix] Total fixed: ${totalFixed} products`);

  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('[fix] Error:', err);
  process.exit(1);
});
