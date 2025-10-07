# Product Facet Extraction & Curation

This document describes the facet extraction system that enriches product data with structured attributes for better curation and recommendation.

## Overview

The facet system extracts structured attributes from unstructured product descriptions, titles, and tags. These attributes enable:
- **Faceted search** - Filter products by occasion, recipient, style, materials, interests, etc.
- **Better recommendations** - Match gifts to recipient preferences and occasion context
- **Graph relationships** - Connect products to Neo4j nodes for collaborative filtering

## Extracted Facets

### Occasions
`birthday`, `anniversary`, `wedding`, `graduation`, `housewarming`, `sympathy`, `christmas`, `valentines`, `mothers_day`, `fathers_day`, `thanksgiving`, `halloween`, `baby_shower`, `retirement`

### Recipients
`for_him`, `for_her`, `for_kids`, `for_couples`, `for_pet_owners`, `for_baby`, `for_teen`

### Values & Ethics
`sustainable`, `handmade`, `local`, `fair_trade`, `vegan`, `organic`, `recycled`, `charitable`

### Themes & Styles
`vintage`, `modern`, `minimalist`, `rustic`, `luxury`, `quirky`, `bohemian`, `elegant`, `cozy`

### Materials
`wood`, `leather`, `ceramic`, `metal`, `fabric`, `glass`, `plastic`, `stone`, `paper`

### Colors
`black`, `white`, `red`, `blue`, `green`, `yellow`, `pink`, `purple`, `orange`, `brown`, `gray`

### Interests & Hobbies
`cooking`, `gardening`, `gaming`, `reading`, `fitness`, `art`, `music`, `travel`, `photography`, `sports`

### Features
`personalizable`, `gift_wrap`

### Age Range
`infant`, `toddler`, `child`, `teen`, `adult`, `senior`

## Data Model

### Table: `product_facets`

```sql
CREATE TABLE IF NOT EXISTS product_facets (
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  facet_key TEXT NOT NULL,
  facet_value TEXT NOT NULL,
  source TEXT, -- 'rules' | 'ml' | 'manual'
  confidence NUMERIC(3,2) DEFAULT 1.0,
  PRIMARY KEY(product_id, facet_key, facet_value)
);
```

## Extraction Methods

### 1. Rule-Based Extraction (`source: 'rules'`)

**Script**: `scripts/extract_facets.mjs`
**Command**: `npm run extract:facets`

Uses regex pattern matching on product titles, descriptions, and tags. Fast, deterministic, high precision but may miss nuanced attributes.

**Current Results** (from 3,114 products):
- Products with facets: 2,694 (86%)
- Total facets extracted: 8,118
- Average facets per product: ~3

**Distribution**:
- **Colors**: 1,951 facets (white, pink, yellow, green most common)
- **Interests**: 1,227 facets (gardening, travel, art lead)
- **Materials**: 1,430 facets (fabric, metal, plastic most common)
- **Occasions**: 877 facets (christmas, holiday, baby, wedding)
- **Recipients**: 1,070 facets (for_her, for_kids, for_him)
- **Themes**: 1,979 facets (quirky, vintage, minimalist, luxury)
- **Values**: 976 facets (sustainable, luxury, organic, handmade)

### 2. LLM-Based Enrichment (`source: 'ml'`)

**Script**: `scripts/enrich_products_llm.mjs`
**Command**: `npm run enrich:llm [batch_size] [limit]`
**Example**: `npm run enrich:llm 50 100` (process first 50 products, limit to 100 total)

Uses GPT-4o-mini to extract structured attributes from product descriptions. More accurate for nuanced attributes, slower and requires OpenAI API key.

**Requirements**:
- `OPENAI_API_KEY` must be set in `.env.local`

**Output**:
- Populates `product_facets` with `source='ml'` and `confidence=0.8`
- Stores full JSON extraction in `products.attributes.llm_extracted`

**Rate Limits**:
- ~10 requests/second for gpt-4o-mini tier
- Built-in 100ms delay between requests

### 3. Manual Curation (`source: 'manual'`)

Future: Admin UI to add/edit facets manually for edge cases and quality control.

## API Endpoints

### GET `/api/facets`

Returns all available facets grouped by key:

```json
{
  "occasion": [
    { "value": "birthday", "count": 72 },
    { "value": "christmas", "count": 157 }
  ],
  "theme": [
    { "value": "vintage", "count": 342 }
  ]
}
```

### GET `/api/products_audit?facets=key:value,key2:value2`

Filter products by facets. Multiple facets are AND-ed together.

**Example**:
```
/api/products_audit?facets=occasion:birthday,theme:vintage&limit=20
```

Returns products that are both for birthdays AND have vintage theme.

## UI: Faceted Search

**URL**: `/products/faceted`

Features:
- **Sidebar filters** - Checkboxes for all facet types
- **Search bar** - Full-text search on title/description
- **Product grid** - 24 products per page with image, title, price
- **URL state** - Filters are shareable via URL params
- **Facet counts** - Shows number of products per facet value

**Example URLs**:
```
/products/faceted?facets=occasion:wedding,theme:elegant
/products/faceted?q=leather&facets=material:leather,recipient:for_him
/products/faceted?facets=value:sustainable,interest:gardening&page=2
```

## Recommendation Integration

### Current: Keyword Search Fallback

The recommendation engine (`src/server/services/recommend.ts`) currently uses keyword search. Facets are not yet integrated.

### Future: Facet-Aware Recommendations

1. **User context extraction** - Parse user/recipient preferences → facet filters
2. **Facet-based retrieval** - Filter by occasion, recipient, values before vector search
3. **Graph traversal** - Use Neo4j to find products that match multiple facets via LIKES/VALUES relationships
4. **Facet-based re-ranking** - Boost products with matching facets even if vector similarity is lower

**Implementation Plan**:
```typescript
// Extract facets from user context
const userFacets = extractUserFacets(userContext); // { occasion: 'birthday', recipient: 'for_her', theme: 'vintage' }

// Build facet filter for SQL/vector queries
const facetFilter = Object.entries(userFacets).map(([key, value]) =>
  `EXISTS (SELECT 1 FROM product_facets WHERE product_id = p.id AND facet_key = '${key}' AND facet_value = '${value}')`
);

// Apply to search
const products = await catalog.search({ text, facets: userFacets });
```

## Performance

### Indexes

```sql
CREATE INDEX IF NOT EXISTS product_facets_key_idx ON product_facets(facet_key);
CREATE INDEX IF NOT EXISTS product_facets_value_idx ON product_facets(facet_value);
CREATE INDEX IF NOT EXISTS product_facets_product_idx ON product_facets(product_id);
```

### Query Performance

- Single facet filter: ~10ms for 3k products
- Multiple facets (3+): ~30ms for 3k products
- Combined with text search: ~50ms

## Maintenance

### Re-running Extraction

Safe to re-run at any time. Uses `ON CONFLICT DO UPDATE` to merge results:

```bash
npm run extract:facets  # Rule-based (fast, ~10s for 3k products)
npm run enrich:llm 100  # LLM-based (slow, ~10s per product)
```

### Adding New Facet Types

1. Add patterns to `scripts/extract_facets.mjs` (`FACET_RULES` array)
2. Update LLM prompt in `scripts/enrich_products_llm.mjs` (`EXTRACTION_PROMPT`)
3. Re-run extraction scripts
4. UI automatically picks up new facets from `/api/facets`

### Quality Control

Check facet distribution:

```sql
SELECT facet_key, COUNT(DISTINCT product_id) as products, COUNT(*) as total_facets
FROM product_facets
GROUP BY facet_key
ORDER BY products DESC;
```

Find products with no facets:

```sql
SELECT p.id, p.title, p.category
FROM products p
LEFT JOIN product_facets pf ON p.id = pf.product_id
WHERE pf.product_id IS NULL;
```

## Next Steps

1. **Integrate facets into recommendation engine** - Use facets for retrieval and re-ranking
2. **Neo4j sync** - Create graph relationships from facets (Product→SUITABLE_FOR→Occasion)
3. **User preference learning** - Track which facets lead to clicks/purchases
4. **LLM enrichment at import** - Auto-enrich new products as they're added
5. **Admin UI for manual facet editing** - Quality control and edge cases
6. **Facet-based product similarity** - "More like this" using facet overlap
7. **Dynamic facet suggestions** - Show most relevant facets based on user context

## Related Files

- `scripts/extract_facets.mjs` - Rule-based extraction
- `scripts/enrich_products_llm.mjs` - LLM enrichment
- `src/server/index.ts` - API endpoints (lines 172-191, 228-255)
- `src/web/app/products/faceted/page.tsx` - Faceted search UI
- `db/sql/schema.sql` - Schema definition (lines 68-76)
