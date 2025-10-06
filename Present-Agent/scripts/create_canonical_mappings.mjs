#!/usr/bin/env node
// Create canonical category mappings for common vendor categories

import pg from 'pg';
import 'dotenv/config';

const POSTGRES_URL = process.env.POSTGRES_URL;
if (!POSTGRES_URL) {
  console.error('[map] POSTGRES_URL not set');
  process.exit(1);
}

// Map common vendor categories to canonical taxonomy
const MAPPINGS = [
  // Flowers & Plants
  { pattern: /^(flowers?|blooming flowers?|plants?|indoor plant|outdoor plant|live plants?|garden)$/i, canonical: 'Flowers & Plants' },
  { pattern: /^(bulbs?|flower bulbs?|fall.planted bulbs?|tulip|daffodil|iris|lily|amaryllis|peony).*$/i, canonical: 'Flowers & Plants' },

  // Books & Media
  { pattern: /^(books?|ebook|recipe book|gardening books?)$/i, canonical: 'Books & Media' },
  { pattern: /^(playing cards?|games?|board games?|puzzles?)$/i, canonical: 'Toys & Games' },

  // Clothing & Accessories
  { pattern: /^(clothing|apparel|tops?|bottoms?|dresses?|shirts?|pants?|sweaters?|outerwear)$/i, canonical: 'Clothing & Accessories' },
  { pattern: /^(womens?|mens?).*(tops?|pants?|dresses?|apparel|clothing|sweaters?|jackets?)$/i, canonical: 'Clothing & Accessories' },
  { pattern: /^(accessories?|bags?|hats?|gloves?|scarves?)$/i, canonical: 'Clothing & Accessories' },

  // Electronics & Gadgets
  { pattern: /^(ps5|ps4|xbox|nintendo|iphone|galaxy|samsung).*$/i, canonical: 'Electronics & Gadgets' },
  { pattern: /^(headphones?|earbuds?|speakers?|audio).*$/i, canonical: 'Electronics & Gadgets' },

  // Food & Beverages
  { pattern: /^(food|chocolate|cookies?|coffee|tea|candy|drink|beverages?)$/i, canonical: 'Food & Beverages' },
  { pattern: /^(cheese|meat|pasta|olives?|jam|spice)$/i, canonical: 'Food & Beverages' },

  // Jewelry & Watches
  { pattern: /^(jewelry|jewellery|rings?|necklaces?|bracelets?|earrings?)$/i, canonical: 'Jewelry & Watches' },
  { pattern: /^(wristwatches?|watches?)$/i, canonical: 'Jewelry & Watches' },

  // Home & Garden
  { pattern: /^(home|decor|furniture|candle|vases?|frames?).*$/i, canonical: 'Home & Garden' },
  { pattern: /^(bedding|towels?|pillows?|blankets?)$/i, canonical: 'Home & Garden' },
  { pattern: /^(cookware|kitchen|mugs?|drinkware|barware)$/i, canonical: 'Home & Garden' },

  // Party Supplies & Decorations
  { pattern: /^(party|balloons?|decorations?|garlands?|tableware).*$/i, canonical: 'Party Supplies & Decorations' },
  { pattern: /^(costumes?|costume accessories)$/i, canonical: 'Party Supplies & Decorations' },
  { pattern: /^(christmas|halloween|thanksgiving).*(party|tableware|decorations?)$/i, canonical: 'Seasonal & Holiday' },

  // Health & Beauty
  { pattern: /^(beauty|skincare|skin care|moisturizer|soap|bath).*$/i, canonical: 'Health & Beauty' },
  { pattern: /^(fragrance|perfume)$/i, canonical: 'Health & Beauty' },

  // Kids & Baby
  { pattern: /^(baby|toddler|kids?|toys?|educational toys).*$/i, canonical: 'Kids & Baby' },

  // Office & Stationery
  { pattern: /^(stationery|pens?|notebooks?|journals?|calendars?)$/i, canonical: 'Office & Stationery' },

  // Gift Cards & Experiences
  { pattern: /^(gift cards?|gift certificates?|classes?)$/i, canonical: 'Gift Cards & Experiences' },

  // Sports & Outdoors
  { pattern: /^(sports?|fitness|gym|outdoor|camping).*$/i, canonical: 'Sports & Outdoors' },

  // Pet Supplies
  { pattern: /^(pet|cat|dog).*$/i, canonical: 'Pet Supplies' },
];

async function main() {
  const client = new pg.Client({ connectionString: POSTGRES_URL });
  await client.connect();

  try {
    // Get all distinct vendor + category combinations from products
    const { rows } = await client.query(`
      SELECT DISTINCT v.name AS vendor, c.name AS category
      FROM products p
      JOIN vendors v ON p.vendor_id = v.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE c.name IS NOT NULL
      ORDER BY v.name, c.name
    `);

    console.log(`[map] Found ${rows.length} vendor+category combinations`);

    let mapped = 0;
    let skipped = 0;

    for (const row of rows) {
      const { vendor, category } = row;

      // Find matching canonical category
      let canonical = null;
      for (const { pattern, canonical: target } of MAPPINGS) {
        if (pattern.test(category)) {
          canonical = target;
          break;
        }
      }

      if (!canonical) {
        skipped++;
        continue;
      }

      // Ensure canonical category exists
      await client.query(`
        INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING
      `, [canonical]);

      const { rows: catRows } = await client.query(`SELECT id FROM categories WHERE name = $1`, [canonical]);
      const targetCategoryId = catRows[0].id;

      // Create mapping
      await client.query(`
        INSERT INTO category_mappings (source_vendor, source_category, target_category_id, rule, confidence)
        VALUES ($1, $2, $3, 'pattern', 1.0)
        ON CONFLICT (source_vendor, source_category) DO UPDATE
        SET target_category_id = EXCLUDED.target_category_id, rule = 'pattern', updated_at = NOW()
      `, [vendor, category, targetCategoryId]);

      mapped++;
    }

    console.log(`[map] Created ${mapped} mappings, skipped ${skipped}`);

  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('[map] Error:', err);
  process.exit(1);
});
