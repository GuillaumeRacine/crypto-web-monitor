# Recommendation Workflow Analysis

## Current State: "Just Shows First Items in List"

You're correct. The current recommendation engine essentially returns the **first N items** from a simple keyword search ordered by `updated_at DESC`. Here's the complete flow:

---

## Complete Workflow Trace

### 1. **User Input** (Frontend: `src/web/app/page.tsx`)
```
User types: "Gift for my sister's birthday, loves gardening, budget $40"
```

**What happens**:
- Frontend extracts budget via regex: `budgetMax = 40`
- Stores in localStorage for display
- Calls `POST /api/chat` with raw text

---

### 2. **Chat Handler** (Backend: `src/server/index.ts` lines 580-820)

**Context Extraction** (lines 590-640):
```typescript
// Extract from user text
const extracted = await extractContext(text);
// Returns:
{
  budgetMin: null,
  budgetMax: 40,
  recipientKey: "sister",
  occasion: "birthday",
  categories: [],  // EMPTY! Not extracted
  values: [],      // EMPTY! Not extracted
}
```

**Ready Check** (line 659):
```typescript
const ready = (merged.budgetMin != null || merged.budgetMax != null)
              && (recipientKey || (merged.categories && merged.categories.length > 0));
```
✅ Passes because: `budgetMax=40` AND `recipientKey="sister"`

**Build Query** (lines 744-752):
```typescript
const recipientHints = buildRecipientSearchHints(recipientKey);
// Returns: "female feminine women girls sister daughter aunt niece"

const enhancedText = `Gift for my sister's birthday, loves gardening, budget $40 female feminine women girls sister daughter aunt niece`;

const query = {
  text: enhancedText,
  budgetMin: null,
  budgetMax: 40,
  categories: [],  // EMPTY!
  limit: 15
};
```

**Problem #1**: ❌ **"loves gardening"** is NOT extracted as a category or interest

---

### 3. **Recommendation Service** (`src/server/services/recommend.ts`)

**Vector Search** (lines 19-39):
```typescript
if (this.vectorIndex && qText) {
  try {
    const hits = await this.vectorIndex.search(qText, limit, filters);
    // ...
  } catch (e) {
    console.warn('[recommend] vector search failed, falling back to keyword');
  }
}
```

**What actually happens**:
- ❌ Vector search **FAILS** (no Qdrant URL or not indexed)
- Falls back to keyword search

**Problem #2**: ❌ Vector DB not configured, so semantic similarity is lost

---

### 4. **Keyword Search Fallback** (`src/server/adapters/fivedb/catalog.postgres.ts` lines 110-148)

```sql
SELECT p.*, v.name AS vendor_name, c.name AS category_name
FROM products p
LEFT JOIN vendors v ON v.id = p.vendor_id
LEFT JOIN categories c ON c.id = p.category_id
WHERE (p.title ILIKE '%Gift for my sister...gardening...%'
       OR p.description ILIKE '%Gift for my sister...gardening...%')
  AND p.price <= 40
ORDER BY p.updated_at DESC  -- ⚠️ JUST MOST RECENTLY UPDATED!
LIMIT 15
```

**What this returns**:
- Products where title/description contains ANY word from the query
- Most likely: products with "gift" or "sister" in title
- **NOT** products related to gardening
- **NOT** sorted by relevance
- Just the 15 most recently updated products that match ANY keyword

**Problem #3**: ❌ No relevance scoring. No semantic understanding. Just `updated_at DESC`.

---

### 5. **Graph Boost** (`src/server/services/recommend.ts` lines 63-80)

```typescript
if (this.graph && input.recipientId && items.length > 0) {
  const prefs = await this.graph.getPreferredCategories(input.recipientId);
  // Boost items matching recipient's preferred categories
}
```

**What happens**:
- ❌ Neo4j likely not configured or no preferences stored
- No boost applied

**Problem #4**: ❌ Recipient preferences not leveraged

---

### 6. **Result Filtering** (Backend: `src/server/index.ts` line 756)

```typescript
result.items = filterInappropriateProducts(result.items, recipientKey).slice(0, 5);
```

**What this does**:
- Filters out products inappropriate for recipient (e.g., adult items for kids)
- Takes first 5 items
- **No re-ranking by quality, relevance, or fit**

**Problem #5**: ❌ Just takes first 5 from already poor keyword match

---

### 7. **Rationale Generation** (`src/server/services/recommend.ts` lines 82-92)

```typescript
items = items.map((it) => {
  const within = budgetMin <= price <= budgetMax;
  const parts: string[] = [];
  if (within) parts.push('fits your budget');
  if (catHint && it.product.category.includes(catHint)) parts.push(`matches ${catHint}`);
  if (parts.length === 0) parts.push('a solid starting point—happy to tune together');
  return { ...it, rationale: `Why: ${parts.join('; ')}` };
});
```

**What you get**:
```
Why: fits your budget; a solid starting point—happy to tune together
```

**Problem #6**: ❌ Generic rationales. No mention of gardening, birthday suitability, or sister preferences.

---

### 8. **Frontend Display** (`src/web/app/page.tsx` lines 88-112)

Frontend adds **client-side rationale enrichment**:
```typescript
const enrichRationale = (items: any[]) => {
  const interests: string[] = [];
  if (/(read|reader|book)/.test(t)) interests.push('books');
  if (/(cook|kitchen|baking)/.test(t)) interests.push('kitchen');
  // Returns: "Why: within your budget; category: Home & Garden"
};
```

**Problem #7**: ❌ Only checks for 3 hardcoded interests (books, kitchen, coffee). No gardening.

---

## Summary of Critical Problems

### 1. **No Interest/Category Extraction**
- User says "loves gardening"
- System extracts: ❌ NOTHING
- Should extract: `categories: ["Flowers & Plants", "Home & Garden"]` or `interests: ["gardening"]`

### 2. **No Semantic Search**
- Vector DB not configured/indexed
- Falls back to dumb keyword `ILIKE` matching
- No understanding that "gardening" relates to "plants", "seeds", "tools", "flowers"

### 3. **No Relevance Ranking**
- Results ordered by `updated_at DESC` (most recently updated)
- Not ordered by:
  - ❌ Text relevance score
  - ❌ Facet match (occasion, recipient, interests)
  - ❌ Popularity or ratings
  - ❌ Semantic similarity

### 4. **No Facet Integration**
- We have 8,118 extracted facets across 2,694 products
- **NONE** of them are used in recommendations!
- Should filter by:
  - ✅ `occasion: birthday`
  - ✅ `recipient: for_her`
  - ✅ `interest: gardening`

### 5. **No Graph Intelligence**
- Neo4j not leveraged
- No recipient preference learning
- No collaborative filtering
- No "people who liked X also liked Y"

### 6. **Weak Rationales**
- Generic: "fits your budget; a solid starting point"
- Should be: "Perfect for your sister's birthday. Great for gardening enthusiasts. Within your $40 budget."

---

## Recommended Improvements (Priority Order)

### **Priority 1: Extract Categories & Interests from User Input**

**Current** (`src/server/services/extract.ts`):
```typescript
// Only extracts: budgetMin, budgetMax, recipientKey, occasion
```

**Needed**:
```typescript
export function extractContext(text: string): ExtractedContext {
  // ... existing code ...

  // NEW: Extract interests
  const interests: string[] = [];
  if (/garden|plant|flower|seed|grow/i.test(text)) interests.push('gardening');
  if (/cook|bake|chef|kitchen|recipe/i.test(text)) interests.push('cooking');
  if (/read|book|novel|literature/i.test(text)) interests.push('reading');
  if (/art|paint|draw|craft/i.test(text)) interests.push('art');
  // ... add 10-15 more

  // NEW: Map interests to categories
  const categories: string[] = [];
  if (interests.includes('gardening')) categories.push('Flowers & Plants', 'Home & Garden');
  if (interests.includes('cooking')) categories.push('Home & Garden', 'Food & Beverages');
  if (interests.includes('reading')) categories.push('Books & Media');

  return { ...existing, categories, interests };
}
```

**Impact**: ⭐⭐⭐⭐⭐ (Critical - fixes root cause)

---

### **Priority 2: Use Facets in Retrieval**

**Current**: Facets exist but are unused

**Needed** (`src/server/adapters/fivedb/catalog.postgres.ts`):
```typescript
async search(q: SearchQuery): Promise<Product[]> {
  // Existing filters
  if (q.text) clauses.push(...);
  if (q.budgetMin) clauses.push(...);
  if (q.categories) clauses.push(...);

  // NEW: Facet filters
  if (q.facets?.occasion) {
    clauses.push(`EXISTS (SELECT 1 FROM product_facets pf
                          WHERE pf.product_id = p.id
                          AND pf.facet_key = 'occasion'
                          AND pf.facet_value = $${i})`);
    params.push(q.facets.occasion);
    i++;
  }

  if (q.facets?.interests?.length) {
    clauses.push(`EXISTS (SELECT 1 FROM product_facets pf
                          WHERE pf.product_id = p.id
                          AND pf.facet_key = 'interest'
                          AND pf.facet_value = ANY($${i}))`);
    params.push(q.facets.interests);
    i++;
  }

  // NEW: Relevance ranking using PostgreSQL full-text search
  if (q.text) {
    const sql = `
      SELECT p.*,
             ts_rank(to_tsvector('english', p.title || ' ' || COALESCE(p.description, '')),
                     plainto_tsquery('english', $1)) AS rank,
             v.name AS vendor_name,
             c.name AS category_name
      FROM products p
      LEFT JOIN vendors v ON v.id = p.vendor_id
      LEFT JOIN categories c ON c.id = p.category_id
      ${where}
      ORDER BY rank DESC, p.updated_at DESC  -- RANK FIRST!
      LIMIT ${limit}
    `;
  }
}
```

**Impact**: ⭐⭐⭐⭐⭐ (Critical - leverages existing facets)

---

### **Priority 3: Facet-Aware Scoring**

**Current**: `score: 1 - i * 0.05` (just position in list)

**Needed** (`src/server/services/recommend.ts`):
```typescript
async recommend(input: RecommendationInput): Promise<RecommendationResult> {
  let items = await this.catalog.search(query);

  // NEW: Score each item based on facet matches
  items = items.map((it, i) => {
    let score = 1 - i * 0.05;  // base position score

    // Fetch facets for this product
    const facets = await getFacets(it.product.id);

    // Boost for occasion match
    if (input.occasion && facets.some(f => f.key === 'occasion' && f.value === input.occasion)) {
      score += 0.3;
    }

    // Boost for recipient match
    if (input.recipientKey && facets.some(f => f.key === 'recipient' && f.value.includes(input.recipientKey))) {
      score += 0.3;
    }

    // Boost for interest match
    if (input.interests?.length) {
      const matchCount = facets.filter(f =>
        f.key === 'interest' && input.interests.includes(f.value)
      ).length;
      score += matchCount * 0.2;
    }

    return { ...it, score };
  });

  // Re-sort by new scores
  items.sort((a, b) => b.score - a.score);

  return { items: items.slice(0, limit) };
}
```

**Impact**: ⭐⭐⭐⭐ (High - makes recommendations actually relevant)

---

### **Priority 4: Semantic Search via Vector DB**

**Current**: ❌ Not configured

**Setup**:
```bash
# 1. Index all products
npm run index:qdrant

# 2. Ensure VECTOR_DB_URL is set in .env.local
VECTOR_DB_URL=http://localhost:6333
OPENAI_API_KEY=sk-...
```

**Impact**: ⭐⭐⭐⭐ (High - enables semantic understanding)

---

### **Priority 5: Better Rationales Using Facets**

**Current**: "fits your budget"

**Needed**:
```typescript
const buildRationale = (product: Product, input: RecommendationInput, facets: Facet[]) => {
  const parts: string[] = [];

  // Occasion
  const occasions = facets.filter(f => f.key === 'occasion').map(f => f.value);
  if (occasions.length && input.occasion && occasions.includes(input.occasion)) {
    parts.push(`Perfect for ${input.occasion}`);
  }

  // Recipient
  const recipients = facets.filter(f => f.key === 'recipient').map(f => f.value);
  if (recipients.length) {
    parts.push(`Great gift for ${recipients.join(' or ')}`);
  }

  // Interests
  const interests = facets.filter(f => f.key === 'interest').map(f => f.value);
  if (interests.length && input.interests?.length) {
    const matches = interests.filter(i => input.interests.includes(i));
    if (matches.length) {
      parts.push(`Ideal for ${matches.join(' and ')} enthusiasts`);
    }
  }

  // Budget
  if (input.query.budgetMax && product.price <= input.query.budgetMax) {
    parts.push(`Within your $${input.query.budgetMax} budget`);
  }

  return parts.join('. ') + '.';
};
```

**Impact**: ⭐⭐⭐ (Medium - improves UX/trust)

---

## Test Case: Before vs After

### **Before** (Current):
```
User: "Gift for my sister's birthday, loves gardening, budget $40"

Query: {
  text: "Gift for my sister's birthday, loves gardening, budget $40 female feminine...",
  budgetMax: 40,
  categories: []  // ❌ EMPTY
}

SQL: WHERE (title ILIKE '%Gift%' OR description ILIKE '%gardening%')
     AND price <= 40
     ORDER BY updated_at DESC  // ❌ NO RELEVANCE
     LIMIT 15

Results: [Most recently added products under $40 with "gift" in title]

Rationale: "Why: fits your budget; a solid starting point"
```

---

### **After** (With Fixes):
```
User: "Gift for my sister's birthday, loves gardening, budget $40"

Extracted: {
  budgetMax: 40,
  recipientKey: "sister",
  occasion: "birthday",
  categories: ["Flowers & Plants", "Home & Garden"],  // ✅ EXTRACTED
  interests: ["gardening"]  // ✅ EXTRACTED
}

Query: {
  text: "gardening plants flowers seeds tools",  // Keywords expanded
  budgetMax: 40,
  categories: ["Flowers & Plants", "Home & Garden"],
  facets: {
    occasion: "birthday",
    recipient: "for_her",
    interests: ["gardening"]
  }
}

SQL: WHERE (ts_rank(...) > 0)  // ✅ RELEVANCE SCORED
     AND price <= 40
     AND c.name IN ('Flowers & Plants', 'Home & Garden')
     AND EXISTS (SELECT 1 FROM product_facets WHERE facet_key='interest' AND facet_value='gardening')
     ORDER BY rank DESC, score DESC  // ✅ RANKED BY RELEVANCE
     LIMIT 15

Facet Scoring:
  - Product A: seed kit, occasion:birthday, interest:gardening → score +0.5
  - Product B: flower bulbs, recipient:for_her, interest:gardening → score +0.5
  - Product C: garden tools, interest:gardening → score +0.2

Results: [Top 5 highest-scored, facet-matched products]

Rationale: "Perfect for birthday. Great gift for her. Ideal for gardening enthusiasts. Within your $40 budget."
```

---

## Next Steps

1. ✅ **Implement Priority 1**: Extract categories/interests from user text
2. ✅ **Implement Priority 2**: Add facet filters to SQL search
3. ✅ **Implement Priority 3**: Facet-aware scoring
4. ⚠️ **Optional**: Setup Qdrant vector search (requires API key)
5. ✅ **Implement Priority 5**: Facet-based rationales

Would you like me to implement these fixes? I can start with Priority 1-3 which will have the biggest impact immediately.
