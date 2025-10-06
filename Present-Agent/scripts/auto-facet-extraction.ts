/**
 * Auto-Facet Extraction with LLM
 *
 * Uses Claude (Anthropic) to automatically extract gift-relevant facets from product data.
 * Extracts: recipient, occasion, interest, value, theme
 *
 * Usage:
 *   npx tsx scripts/auto-facet-extraction.ts [--limit N] [--product-id ID]
 *
 * Examples:
 *   npx tsx scripts/auto-facet-extraction.ts --limit 10          # Extract facets for 10 products
 *   npx tsx scripts/auto-facet-extraction.ts --product-id 123    # Extract for specific product
 *   npx tsx scripts/auto-facet-extraction.ts                     # Process all products
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import pg from 'pg';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

interface Product {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  vendor: string | null;
  price: number;
}

interface ExtractedFacet {
  key: string;
  value: string;
  confidence: number;
}

/**
 * Extract facets from a single product using Claude
 */
async function extractFacetsWithLLM(product: Product): Promise<ExtractedFacet[]> {
  const prompt = `Analyze this product and extract gift-relevant facets:

Title: ${product.title}
Description: ${product.description || 'N/A'}
Category: ${product.category || 'N/A'}
Vendor: ${product.vendor || 'N/A'}
Price: $${product.price}

Extract the following facets (only if clearly applicable):

1. **recipient**: Who is this gift appropriate for?
   Values: him, her, them, kids, baby, toddler, teen, friend, best_friend, mom, mother, dad, father,
   parents, grandma, grandpa, sister, brother, wife, husband, spouse, partner, girlfriend, boyfriend,
   colleague, coworker, boss, teacher, neighbor

2. **occasion**: What occasions is this suitable for?
   Values: birthday, anniversary, wedding, engagement, graduation, retirement, baby_shower,
   christmas, hanukkah, new_year, valentine, mother_day, father_day, easter, thanksgiving,
   house_warming, thank_you, get_well, congratulations, just_because

3. **interest**: What hobbies/activities does this relate to?
   Values: fishing, hunting, camping, hiking, outdoors, sports, gaming, cooking, baking, grilling,
   wine, beer, coffee, tea, gardening, plants, art, painting, crafts, diy, music, reading, writing,
   photography, travel, fitness, yoga, running, cycling, pets, dogs, cats, tech, fashion, beauty,
   home_decor, movies, collectibles

4. **value**: What ethical/aesthetic values does this represent?
   Values: sustainable, eco_friendly, organic, fair_trade, recycled, handmade, artisan, handcrafted,
   personalized, customized, engraved, luxury, premium, designer, minimalist, simple, modern,
   quirky, unique, creative, practical, functional, sentimental, local, small_business, vintage

5. **theme**: What visual/conceptual style?
   Values: rustic, farmhouse, modern, contemporary, vintage, retro, elegant, sophisticated, playful,
   fun, minimalist, bohemian, industrial, nautical, tropical, romantic, feminine, masculine, bold

For each facet:
- Provide confidence score 0.0-1.0 (minimum 0.5 to include)
- Can extract multiple values per facet key
- Be specific and conservative (only include if clearly applicable)

Return JSON only (no markdown, no explanation):
{
  "facets": [
    {"key": "recipient", "value": "him", "confidence": 0.9},
    {"key": "interest", "value": "fishing", "confidence": 0.95}
  ]
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    // Extract JSON from response (handle markdown code blocks)
    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(jsonText);

    // Validate and filter facets
    const validFacets = parsed.facets.filter((f: ExtractedFacet) =>
      f.key && f.value && typeof f.confidence === 'number' && f.confidence >= 0.5
    );

    return validFacets;
  } catch (error: any) {
    console.error(`Failed to extract facets for product ${product.id}:`, error.message);
    return [];
  }
}

/**
 * Upsert facets into database
 */
async function upsertFacets(productId: string, facets: ExtractedFacet[]): Promise<void> {
  for (const facet of facets) {
    await pool.query(`
      INSERT INTO product_facets (product_id, facet_key, facet_value, confidence)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (product_id, facet_key, facet_value)
      DO UPDATE SET confidence = EXCLUDED.confidence
    `, [productId, facet.key, facet.value, facet.confidence]);
  }
}

/**
 * Process products in batches with rate limiting
 */
async function processBatch(products: Product[], batchSize = 5, delayMs = 1000): Promise<void> {
  let processed = 0;
  let totalFacets = 0;
  let failed = 0;

  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);

    const results = await Promise.allSettled(
      batch.map(async (product) => {
        const facets = await extractFacetsWithLLM(product);
        if (facets.length > 0) {
          await upsertFacets(product.id, facets);
        }
        return { productId: product.id, facetsCount: facets.length };
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        processed++;
        totalFacets += result.value.facetsCount;
        console.log(`✅ Product ${result.value.productId}: extracted ${result.value.facetsCount} facets`);
      } else {
        failed++;
        console.error(`❌ Failed:`, result.reason.message);
      }
    }

    const progress = Math.round((processed / products.length) * 100);
    console.log(`Progress: ${processed}/${products.length} (${progress}%) | Total facets: ${totalFacets} | Failed: ${failed}`);

    // Rate limiting: wait between batches (except for last batch)
    if (i + batchSize < products.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Processed: ${processed} products`);
  console.log(`Total facets extracted: ${totalFacets}`);
  console.log(`Average facets per product: ${(totalFacets / processed).toFixed(2)}`);
  console.log(`Failed: ${failed}`);
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  let limit: number | undefined;
  let productId: string | undefined;

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--product-id' && args[i + 1]) {
      productId = args[i + 1];
      i++;
    }
  }

  console.log('=== Auto-Facet Extraction with LLM ===\n');

  // Check API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY not found in environment');
    console.error('Please set ANTHROPIC_API_KEY in your .env.local file');
    process.exit(1);
  }

  try {
    let products: Product[];

    if (productId) {
      // Extract facets for specific product
      console.log(`Extracting facets for product ID: ${productId}\n`);

      const result = await pool.query<Product>(
        'SELECT id, title, description, category, vendor, price FROM products WHERE id = $1',
        [productId]
      );

      if (result.rows.length === 0) {
        console.error(`Product ${productId} not found`);
        process.exit(1);
      }

      products = result.rows;
    } else {
      // Fetch products without facets (or all if limit specified)
      console.log(limit ? `Extracting facets for ${limit} products\n` : 'Extracting facets for all products without facets\n');

      const query = limit
        ? `SELECT id, title, description, category, vendor, price FROM products LIMIT $1`
        : `SELECT p.id, p.title, p.description, p.category, p.vendor, p.price
           FROM products p
           LEFT JOIN product_facets pf ON p.id = pf.product_id
           WHERE pf.product_id IS NULL
           LIMIT 1000`;

      const result = await pool.query<Product>(query, limit ? [limit] : []);
      products = result.rows;

      if (products.length === 0) {
        console.log('No products found to process. All products already have facets!');
        process.exit(0);
      }

      console.log(`Found ${products.length} products to process\n`);
    }

    // Process products
    await processBatch(products, 5, 1000); // 5 products per batch, 1 second delay

    console.log('\n✅ Facet extraction complete!');

  } catch (error: any) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { extractFacetsWithLLM, upsertFacets };
