#!/usr/bin/env node
// Extract facets from product descriptions and tags using pattern matching and NLP

import pg from 'pg';
import 'dotenv/config';

const POSTGRES_URL = process.env.POSTGRES_URL;
if (!POSTGRES_URL) {
  console.error('[extract-facets] POSTGRES_URL not set');
  process.exit(1);
}

// Facet extraction rules (pattern → facet_key:facet_value)
const FACET_RULES = [
  // Occasions
  { pattern: /\b(birthday|bday|b-day)\b/i, key: 'occasion', value: 'birthday', confidence: 0.9 },
  { pattern: /\b(anniversary|anniversaries)\b/i, key: 'occasion', value: 'anniversary', confidence: 0.9 },
  { pattern: /\b(wedding|bridal|bride|groom)\b/i, key: 'occasion', value: 'wedding', confidence: 0.9 },
  { pattern: /\b(graduation|graduate|grad)\b/i, key: 'occasion', value: 'graduation', confidence: 0.9 },
  { pattern: /\b(housewarming|new home|moving)\b/i, key: 'occasion', value: 'housewarming', confidence: 0.8 },
  { pattern: /\b(sympathy|condolence|memorial|funeral)\b/i, key: 'occasion', value: 'sympathy', confidence: 0.9 },
  { pattern: /\b(christmas|xmas|holiday)\b/i, key: 'occasion', value: 'christmas', confidence: 0.9 },
  { pattern: /\b(valentine|valentines)\b/i, key: 'occasion', value: 'valentines', confidence: 0.9 },
  { pattern: /\b(mother'?s day|mom)\b/i, key: 'occasion', value: 'mothers_day', confidence: 0.8 },
  { pattern: /\b(father'?s day|dad)\b/i, key: 'occasion', value: 'fathers_day', confidence: 0.8 },
  { pattern: /\b(thanksgiving)\b/i, key: 'occasion', value: 'thanksgiving', confidence: 0.9 },
  { pattern: /\b(halloween)\b/i, key: 'occasion', value: 'halloween', confidence: 0.9 },
  { pattern: /\b(baby shower|new baby|newborn)\b/i, key: 'occasion', value: 'baby_shower', confidence: 0.9 },
  { pattern: /\b(retirement|retiring)\b/i, key: 'occasion', value: 'retirement', confidence: 0.9 },

  // Recipients (careful with pronouns in context)
  { pattern: /\b(for him|men'?s|male|gentleman|guy)\b/i, key: 'recipient', value: 'for_him', confidence: 0.7 },
  { pattern: /\b(for her|women'?s|female|lady|girl)\b/i, key: 'recipient', value: 'for_her', confidence: 0.7 },
  { pattern: /\b(for kids|children|child|kid)\b/i, key: 'recipient', value: 'for_kids', confidence: 0.8 },
  { pattern: /\b(for couples|couple|partner|newlywed)\b/i, key: 'recipient', value: 'for_couples', confidence: 0.8 },
  { pattern: /\b(for pets?|dog|cat|puppy|kitten)\b/i, key: 'recipient', value: 'for_pet_owners', confidence: 0.7 },
  { pattern: /\b(for baby|infant|toddler)\b/i, key: 'recipient', value: 'for_baby', confidence: 0.8 },
  { pattern: /\b(for teens?|teenager|adolescent)\b/i, key: 'recipient', value: 'for_teen', confidence: 0.8 },

  // Values & Ethics
  { pattern: /\b(sustainable|eco-friendly|eco friendly|environmentally)\b/i, key: 'value', value: 'sustainable', confidence: 0.9 },
  { pattern: /\b(handmade|hand made|hand-crafted|handcrafted|artisan)\b/i, key: 'value', value: 'handmade', confidence: 0.9 },
  { pattern: /\b(local|locally made|local business)\b/i, key: 'value', value: 'local', confidence: 0.8 },
  { pattern: /\b(fair trade|fairtrade|ethical)\b/i, key: 'value', value: 'fair_trade', confidence: 0.9 },
  { pattern: /\b(vegan|plant-based)\b/i, key: 'value', value: 'vegan', confidence: 0.9 },
  { pattern: /\b(organic|natural)\b/i, key: 'value', value: 'organic', confidence: 0.8 },
  { pattern: /\b(recycled|upcycled|repurposed)\b/i, key: 'value', value: 'recycled', confidence: 0.8 },
  { pattern: /\b(charitable|charity|give back|donation)\b/i, key: 'value', value: 'charitable', confidence: 0.8 },

  // Themes & Styles
  { pattern: /\b(vintage|retro|classic|antique)\b/i, key: 'theme', value: 'vintage', confidence: 0.8 },
  { pattern: /\b(modern|contemporary|sleek)\b/i, key: 'theme', value: 'modern', confidence: 0.8 },
  { pattern: /\b(minimalist|minimal|simple|clean)\b/i, key: 'theme', value: 'minimalist', confidence: 0.8 },
  { pattern: /\b(rustic|farmhouse|country)\b/i, key: 'theme', value: 'rustic', confidence: 0.8 },
  { pattern: /\b(luxury|luxe|premium|high-end|upscale)\b/i, key: 'theme', value: 'luxury', confidence: 0.8 },
  { pattern: /\b(quirky|unique|unusual|whimsical|fun)\b/i, key: 'theme', value: 'quirky', confidence: 0.7 },
  { pattern: /\b(bohemian|boho|eclectic)\b/i, key: 'theme', value: 'bohemian', confidence: 0.8 },
  { pattern: /\b(elegant|sophisticated|refined)\b/i, key: 'theme', value: 'elegant', confidence: 0.8 },
  { pattern: /\b(cozy|comfy|comfortable)\b/i, key: 'theme', value: 'cozy', confidence: 0.7 },

  // Materials
  { pattern: /\b(wood|wooden|timber)\b/i, key: 'material', value: 'wood', confidence: 0.9 },
  { pattern: /\b(leather)\b/i, key: 'material', value: 'leather', confidence: 0.9 },
  { pattern: /\b(ceramic|porcelain|pottery)\b/i, key: 'material', value: 'ceramic', confidence: 0.9 },
  { pattern: /\b(metal|steel|brass|copper|aluminum|iron)\b/i, key: 'material', value: 'metal', confidence: 0.9 },
  { pattern: /\b(fabric|textile|cloth|cotton|linen|silk|wool)\b/i, key: 'material', value: 'fabric', confidence: 0.8 },
  { pattern: /\b(glass|crystal)\b/i, key: 'material', value: 'glass', confidence: 0.9 },
  { pattern: /\b(plastic|acrylic)\b/i, key: 'material', value: 'plastic', confidence: 0.8 },
  { pattern: /\b(stone|marble|granite)\b/i, key: 'material', value: 'stone', confidence: 0.9 },
  { pattern: /\b(paper|cardboard)\b/i, key: 'material', value: 'paper', confidence: 0.8 },

  // Colors (common ones)
  { pattern: /\b(black)\b/i, key: 'color', value: 'black', confidence: 0.7 },
  { pattern: /\b(white|ivory)\b/i, key: 'color', value: 'white', confidence: 0.7 },
  { pattern: /\b(red|crimson|scarlet)\b/i, key: 'color', value: 'red', confidence: 0.7 },
  { pattern: /\b(blue|navy|azure)\b/i, key: 'color', value: 'blue', confidence: 0.7 },
  { pattern: /\b(green|emerald|olive)\b/i, key: 'color', value: 'green', confidence: 0.7 },
  { pattern: /\b(yellow|gold|golden)\b/i, key: 'color', value: 'yellow', confidence: 0.7 },
  { pattern: /\b(pink|rose)\b/i, key: 'color', value: 'pink', confidence: 0.7 },
  { pattern: /\b(purple|violet|lavender)\b/i, key: 'color', value: 'purple', confidence: 0.7 },
  { pattern: /\b(orange)\b/i, key: 'color', value: 'orange', confidence: 0.7 },
  { pattern: /\b(brown|tan|beige)\b/i, key: 'color', value: 'brown', confidence: 0.7 },
  { pattern: /\b(gray|grey|silver)\b/i, key: 'color', value: 'gray', confidence: 0.7 },

  // Interests & Hobbies
  { pattern: /\b(cooking|culinary|chef|kitchen)\b/i, key: 'interest', value: 'cooking', confidence: 0.8 },
  { pattern: /\b(gardening|garden|plant|flower)\b/i, key: 'interest', value: 'gardening', confidence: 0.8 },
  { pattern: /\b(gaming|gamer|video game|board game)\b/i, key: 'interest', value: 'gaming', confidence: 0.8 },
  { pattern: /\b(reading|book|literature|reader)\b/i, key: 'interest', value: 'reading', confidence: 0.8 },
  { pattern: /\b(fitness|exercise|workout|gym|yoga)\b/i, key: 'interest', value: 'fitness', confidence: 0.8 },
  { pattern: /\b(art|artist|painting|drawing|sculpture)\b/i, key: 'interest', value: 'art', confidence: 0.8 },
  { pattern: /\b(music|musician|instrument|guitar|piano)\b/i, key: 'interest', value: 'music', confidence: 0.8 },
  { pattern: /\b(travel|traveler|adventure|wanderlust)\b/i, key: 'interest', value: 'travel', confidence: 0.8 },
  { pattern: /\b(photography|photographer|camera)\b/i, key: 'interest', value: 'photography', confidence: 0.8 },
  { pattern: /\b(sports?|athlete|athletic)\b/i, key: 'interest', value: 'sports', confidence: 0.7 },
];

async function extractFacets(product) {
  const text = `${product.title} ${product.description || ''} ${(product.tags || []).join(' ')}`.toLowerCase();
  const facets = [];

  for (const rule of FACET_RULES) {
    if (rule.pattern.test(text)) {
      facets.push({
        key: rule.key,
        value: rule.value,
        confidence: rule.confidence,
      });
    }
  }

  return facets;
}

async function main() {
  const client = new pg.Client({ connectionString: POSTGRES_URL });
  await client.connect();

  try {
    console.log('[extract-facets] Fetching products...');
    const { rows: products } = await client.query('SELECT id, title, description, tags FROM products');
    console.log(`[extract-facets] Processing ${products.length} products...`);

    let totalFacets = 0;
    let productsWithFacets = 0;

    for (const product of products) {
      const facets = await extractFacets(product);

      if (facets.length > 0) {
        productsWithFacets++;

        for (const facet of facets) {
          // Upsert facet
          await client.query(`
            INSERT INTO product_facets (product_id, facet_key, facet_value, source, confidence)
            VALUES ($1, $2, $3, 'rules', $4)
            ON CONFLICT (product_id, facet_key, facet_value)
            DO UPDATE SET confidence = GREATEST(product_facets.confidence, EXCLUDED.confidence)
          `, [product.id, facet.key, facet.value, facet.confidence]);

          totalFacets++;
        }
      }
    }

    console.log(`\n[extract-facets] Complete!`);
    console.log(`  - Products processed: ${products.length}`);
    console.log(`  - Products with facets: ${productsWithFacets}`);
    console.log(`  - Total facets extracted: ${totalFacets}`);

    // Show facet distribution
    const { rows: distribution } = await client.query(`
      SELECT facet_key, facet_value, COUNT(*) as count
      FROM product_facets
      WHERE source = 'rules'
      GROUP BY facet_key, facet_value
      ORDER BY facet_key, count DESC
    `);

    console.log('\n[extract-facets] Facet distribution:');
    let currentKey = '';
    for (const row of distribution) {
      if (row.facet_key !== currentKey) {
        currentKey = row.facet_key;
        console.log(`\n  ${currentKey}:`);
      }
      console.log(`    - ${row.facet_value}: ${row.count}`);
    }

  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('[extract-facets] Error:', err);
  process.exit(1);
});
