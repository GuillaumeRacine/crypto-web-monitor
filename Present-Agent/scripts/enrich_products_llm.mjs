#!/usr/bin/env node
// Use LLM to extract structured attributes from product descriptions

import pg from 'pg';
import 'dotenv/config';
import OpenAI from 'openai';

const POSTGRES_URL = process.env.POSTGRES_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!POSTGRES_URL) {
  console.error('[enrich-llm] POSTGRES_URL not set');
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.error('[enrich-llm] OPENAI_API_KEY not set - skipping LLM enrichment');
  process.exit(0);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const EXTRACTION_PROMPT = `You are a gift curation assistant. Extract structured attributes from this product description.

Product Title: {TITLE}
Description: {DESCRIPTION}
Category: {CATEGORY}
Tags: {TAGS}

Extract the following attributes as JSON (return only valid JSON, no markdown):
{
  "occasions": [],        // occasions this product is suitable for (e.g., "birthday", "wedding", "anniversary", "graduation", "christmas", "valentines", "mothers_day", "fathers_day", "housewarming", "baby_shower", "thank_you", "sympathy")
  "recipients": [],       // who this is good for (e.g., "for_him", "for_her", "for_kids", "for_couples", "for_pet_owners", "for_baby", "for_teen")
  "values": [],           // ethical/values signals (e.g., "sustainable", "handmade", "local", "fair_trade", "vegan", "organic", "recycled")
  "themes": [],           // style themes (e.g., "vintage", "modern", "minimalist", "rustic", "luxury", "quirky", "bohemian", "elegant", "cozy")
  "interests": [],        // hobbies/interests (e.g., "cooking", "gardening", "gaming", "reading", "fitness", "art", "music", "travel", "photography", "sports")
  "materials": [],        // primary materials (e.g., "wood", "leather", "ceramic", "metal", "fabric", "glass", "plastic", "stone", "paper")
  "colors": [],           // dominant colors (e.g., "black", "white", "red", "blue", "green", "yellow", "pink", "purple", "orange", "brown", "gray")
  "personalization": false, // can this be personalized/customized?
  "gift_wrap_available": false, // is gift wrapping mentioned?
  "age_range": null       // target age if applicable ("infant", "toddler", "child", "teen", "adult", "senior") or null
}

Rules:
- Only include attributes that are clearly indicated in the text
- Be conservative - don't infer too much
- Return empty arrays for attributes not found
- Use snake_case for multi-word values
- Limit each array to max 3 most relevant items`;

async function enrichProduct(product) {
  const prompt = EXTRACTION_PROMPT
    .replace('{TITLE}', product.title)
    .replace('{DESCRIPTION}', product.description || 'N/A')
    .replace('{CATEGORY}', product.category || 'N/A')
    .replace('{TAGS}', (product.tags || []).join(', ') || 'N/A');

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return null;

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn(`[enrich-llm] No JSON found in response for ${product.id}`);
      return null;
    }

    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.warn(`[enrich-llm] Error enriching ${product.id}:`, err.message);
    return null;
  }
}

async function main() {
  const batchSize = parseInt(process.argv[2]) || 100;
  const limit = parseInt(process.argv[3]) || null;

  const client = new pg.Client({ connectionString: POSTGRES_URL });
  await client.connect();

  try {
    // Get products that need enrichment (no ML-sourced facets yet)
    const query = limit
      ? `SELECT DISTINCT p.id, p.title, p.description, c.name as category, p.tags
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         LEFT JOIN product_facets pf ON p.id = pf.product_id AND pf.source = 'ml'
         WHERE pf.product_id IS NULL AND p.description IS NOT NULL AND p.description != ''
         LIMIT ${limit}`
      : `SELECT DISTINCT p.id, p.title, p.description, c.name as category, p.tags
         FROM products p
         LEFT JOIN categories c ON p.category_id = c.id
         LEFT JOIN product_facets pf ON p.id = pf.product_id AND pf.source = 'ml'
         WHERE pf.product_id IS NULL AND p.description IS NOT NULL AND p.description != ''`;

    console.log('[enrich-llm] Fetching products needing enrichment...');
    const { rows: products } = await client.query(query);
    console.log(`[enrich-llm] Found ${products.length} products to enrich (batch size: ${batchSize})`);

    if (products.length === 0) {
      console.log('[enrich-llm] No products need enrichment. Done!');
      return;
    }

    let processed = 0;
    let enriched = 0;
    let totalFacets = 0;

    // Process in batches with rate limiting
    for (let i = 0; i < Math.min(products.length, batchSize); i++) {
      const product = products[i];
      processed++;

      const extracted = await enrichProduct(product);
      if (!extracted) continue;

      enriched++;

      // Store extracted facets
      const facetsToStore = [];

      // Occasions
      for (const occasion of (extracted.occasions || [])) {
        facetsToStore.push({ key: 'occasion', value: occasion.toLowerCase().replace(/\s+/g, '_') });
      }

      // Recipients
      for (const recipient of (extracted.recipients || [])) {
        facetsToStore.push({ key: 'recipient', value: recipient.toLowerCase().replace(/\s+/g, '_') });
      }

      // Values
      for (const value of (extracted.values || [])) {
        facetsToStore.push({ key: 'value', value: value.toLowerCase().replace(/\s+/g, '_') });
      }

      // Themes
      for (const theme of (extracted.themes || [])) {
        facetsToStore.push({ key: 'theme', value: theme.toLowerCase().replace(/\s+/g, '_') });
      }

      // Interests
      for (const interest of (extracted.interests || [])) {
        facetsToStore.push({ key: 'interest', value: interest.toLowerCase().replace(/\s+/g, '_') });
      }

      // Materials
      for (const material of (extracted.materials || [])) {
        facetsToStore.push({ key: 'material', value: material.toLowerCase().replace(/\s+/g, '_') });
      }

      // Colors
      for (const color of (extracted.colors || [])) {
        facetsToStore.push({ key: 'color', value: color.toLowerCase().replace(/\s+/g, '_') });
      }

      // Personalization
      if (extracted.personalization) {
        facetsToStore.push({ key: 'feature', value: 'personalizable' });
      }

      // Gift wrap
      if (extracted.gift_wrap_available) {
        facetsToStore.push({ key: 'feature', value: 'gift_wrap' });
      }

      // Age range
      if (extracted.age_range) {
        facetsToStore.push({ key: 'age_range', value: extracted.age_range.toLowerCase() });
      }

      // Insert facets
      for (const facet of facetsToStore) {
        await client.query(`
          INSERT INTO product_facets (product_id, facet_key, facet_value, source, confidence)
          VALUES ($1, $2, $3, 'ml', 0.8)
          ON CONFLICT (product_id, facet_key, facet_value)
          DO UPDATE SET confidence = GREATEST(product_facets.confidence, EXCLUDED.confidence)
        `, [product.id, facet.key, facet.value]);
        totalFacets++;
      }

      // Store raw attributes in product.attributes
      await client.query(`
        UPDATE products SET attributes = attributes || $1::jsonb WHERE id = $2
      `, [JSON.stringify({ llm_extracted: extracted }), product.id]);

      if (processed % 10 === 0) {
        console.log(`[enrich-llm] Progress: ${processed}/${Math.min(products.length, batchSize)} products (${enriched} enriched, ${totalFacets} facets)`);
      }

      // Rate limiting: ~10 req/sec for gpt-4o-mini tier
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n[enrich-llm] Complete!`);
    console.log(`  - Products processed: ${processed}`);
    console.log(`  - Products enriched: ${enriched}`);
    console.log(`  - Total facets added: ${totalFacets}`);

  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('[enrich-llm] Error:', err);
  process.exit(1);
});
