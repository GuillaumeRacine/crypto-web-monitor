# LLM Guide: Building World-Class Gift Recommendations

**For: LLM agents, AI assistants, and developers working on the Present-Agent recommendation system**

This document provides comprehensive instructions, context, and best practices for LLMs to understand and enhance the gift recommendation engine. It covers the full recommendation pipeline, from intent extraction to final rationale generation.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [The Recommendation Pipeline](#the-recommendation-pipeline)
3. [Intent Extraction Deep Dive](#intent-extraction-deep-dive)
4. [Semantic Search & Vector Retrieval](#semantic-search--vector-retrieval)
5. [Facet-Based Scoring](#facet-based-scoring)
6. [Reranking for Quality](#reranking-for-quality)
7. [Rationale Generation](#rationale-generation)
8. [Context Management](#context-management)
9. [Common Patterns & Edge Cases](#common-patterns--edge-cases)
10. [Performance Optimization](#performance-optimization)
11. [Testing & Validation](#testing--validation)

---

## System Overview

### Core Philosophy

Present-Agent is **NOT** a product search engine. It's a **gift discovery assistant** that understands:
- **Who** you're shopping for (relationship: friend, mom, colleague)
- **Why** you're giving a gift (occasion: birthday, wedding, thank you)
- **What** they care about (interests: fishing, cooking, sustainability)
- **How much** you want to spend (budget: $50-100)
- **What matters** to you and them (values: handmade, local, eco-friendly)

### Key Differentiators

| Traditional E-commerce | Present-Agent |
|------------------------|---------------|
| Keyword matching | Semantic understanding |
| Category silos | Cross-category discovery |
| Generic ranking | Relationship-aware personalization |
| Product features | Gift-giving context |
| "Here are fishing rods" | "Here's a lure making kit perfect for your friend who loves fishing" |

### Architecture at a Glance

```
User: "Gift for my friend who loves fishing, under $100"
    ↓
[Intent Extraction]
    recipient: friend
    interests: [fishing]
    budgetMax: 100
    ↓
[Context Merging]
    + Stored preferences from past conversations
    + Relationship history from Neo4j graph
    ↓
[Vector Search]
    Query: "fishing sports & outdoors"
    Returns: 30 semantically similar products
    ↓
[Facet Boosting]
    +0.3 for recipient=friend match
    +0.3 for interest=fishing match
    +0.2 for within budget
    ↓
[Cohere Reranking]
    30 → 15 results using rerank-english-v3.0
    ↓
[Rationale Generation]
    "Why: Ideal for fishing enthusiasts. Great gift for a friend. Within your $100 budget."
    ↓
Return to user with explanations
```

---

## The Recommendation Pipeline

### File: `src/server/services/recommend.ts`

The `RecommendService` orchestrates the entire pipeline. Here's the step-by-step flow:

### Step 1: Input Normalization

```typescript
interface RecommendationInput {
  query?: {
    text?: string;           // "fishing gifts"
    budgetMin?: number;      // 50
    budgetMax?: number;      // 100
    categories?: string[];   // ["Sports & Outdoors"]
    interests?: string[];    // ["fishing"]
    facets?: {
      recipient?: string;    // "friend"
      occasions?: string[];  // ["birthday"]
      values?: string[];     // ["sustainable"]
    };
    limit?: number;          // 15
  };
  occasion?: string;         // "birthday"
  recipientId?: string;      // Neo4j node ID
  interests?: string[];      // ["fishing", "outdoors"]
}
```

**LLM Instruction**: When building recommendation queries, ensure all budget values are numbers, categories use canonical taxonomy, and interests/recipients use standardized keys.

### Step 2: Hybrid Vector Search

**Current Implementation** (recommend.ts:36-68):
```typescript
// Try semantic search first
if (this.vectorIndex && qText) {
  const vectorLimit = Math.min(limit * 3, 30); // Get 3x candidates for reranking
  const hits = await this.vectorIndex.search(qText, vectorLimit, {
    budgetMin: input.query?.budgetMin,
    budgetMax: input.query?.budgetMax,
    // NO category filter - let semantic search find matches everywhere
  });
}
```

**Key Decision**: We retrieve **3x the final limit** (30 for 15 results) to give the reranker enough candidates.

**LLM Instruction**:
- Vector search should be **permissive** (budget filters only, no rigid categories)
- Query text should be **semantically rich** ("fishing outdoor activities" not just "fishing")
- Always prefer semantic search over keyword search for quality

### Step 3: Facet-Aware Scoring

**Current Implementation** (recommend.ts:94-157):
```typescript
// Boost for occasion match
if (input.occasion) {
  const occasionMatch = facets.find(f => f.key === 'occasion' && f.value.includes(input.occasion!));
  if (occasionMatch) score += 0.4 * occasionMatch.confidence;
}

// Boost for recipient match
if (input.query?.facets?.recipient) {
  const recipientMatch = facets.find(f => f.key === 'recipient' && f.value.includes(input.query!.facets!.recipient!));
  if (recipientMatch) score += 0.3 * recipientMatch.confidence;
}

// Boost for interest matches
if (input.interests && input.interests.length > 0) {
  const interestMatches = facets.filter(f => f.key === 'interest' && input.interests!.includes(f.value));
  score += interestMatches.reduce((sum, f) => sum + (0.3 * f.confidence), 0);
}

// Boost for value matches
if (input.query?.facets?.values && input.query.facets.values.length > 0) {
  const valueMatches = facets.filter(f => f.key === 'value' && input.query!.facets!.values!.includes(f.value));
  score += valueMatches.reduce((sum, f) => sum + (0.2 * f.confidence), 0);
}
```

**Boosting Weights** (in priority order):
1. **Occasion**: +0.4 × confidence (highest priority - "birthday gift" is very specific)
2. **Recipient**: +0.3 × confidence (who it's for matters a lot)
3. **Interests**: +0.3 × confidence per match (can stack for multiple interests)
4. **Values**: +0.2 × confidence per match (nice-to-have, not must-have)

**LLM Instruction**: When adjusting boost weights:
- Occasion is most specific → highest weight
- Recipient is second (gift for "mom" vs "colleague" is very different)
- Interests stack (product matching 2 interests gets 0.6 total boost)
- Values are preferences, not requirements (lower weight)

### Step 4: Graph-Aware Boosting (Optional)

If Neo4j is available and recipient has known preferences:

```typescript
if (this.graph && input.recipientId && items.length > 0) {
  const prefs = await this.graph.getPreferredCategories(input.recipientId);
  items = items.map((it) => {
    const cat = (it.product.category || "").toLowerCase();
    const boost = prefSet.has(cat) ? 0.3 : 0;
    return { ...it, score: it.score + boost };
  });
}
```

**LLM Instruction**: Graph preferences are learned from past successful gifts. Use them to boost proven categories for this specific relationship.

### Step 5: Cohere Reranking

**File**: `src/server/services/reranker.ts`

```typescript
const documents = products.map((item) => {
  const parts = [
    item.product.title,
    item.product.description || "",
    item.product.category || "",
    item.product.vendor || "",
  ];
  return parts.filter(Boolean).join(" | ");
});

const response = await this.cohere.rerank({
  query,
  documents,
  topN,
  model: "rerank-english-v3.0",
});

// Combine: 30% semantic + 70% rerank
score: originalItem.score * 0.3 + result.relevanceScore * 0.7
```

**Why Reranking?**
- Vector search finds similar products semantically but may not understand nuanced query intent
- Reranking models are trained specifically to match queries to documents
- Cohere's rerank-english-v3.0 is state-of-the-art for this task

**LLM Instruction**:
- Reranking is the **final quality gate**
- It gets the last word on relevance (70% of final score)
- Always include title + description + category + vendor in documents for best results

### Step 6: Rationale Generation

**Current Implementation** (recommend.ts:188-247):

```typescript
items = items.map((it: any) => {
  const parts: string[] = [];
  const facets = it.facets || [];

  // Check occasion match
  if (input.occasion) {
    const occasionFacets = facets.filter((f: any) => f.key === 'occasion');
    if (occasionFacets.length > 0 && occasionFacets.some((f: any) => f.value.includes(input.occasion!))) {
      parts.push(`Perfect for ${input.occasion}`);
    }
  }

  // Check recipient match
  if (input.query?.facets?.recipient) {
    const match = recipientFacets.find((f: any) => f.value.includes(input.query!.facets!.recipient!));
    if (match) {
      parts.push(`Great gift ${match.value.replace(/_/g, ' ')}`);
    }
  }

  // Fallback
  if (parts.length === 0) {
    parts.push('A thoughtful choice based on your preferences');
  }

  return { ...it, rationale: `Why: ${parts.join('. ')}.` };
});
```

**LLM Instruction for Better Rationales**:
- Be **specific** ("Perfect for birthdays" not "Great for occasions")
- Be **personal** ("Great gift for a friend" not "For friends")
- **Stack signals** ("Ideal for fishing enthusiasts. Great gift for a friend. Within your $100 budget.")
- **Never be vague** (avoid "A good choice" - explain WHY it's good)

---

## Intent Extraction Deep Dive

### File: `src/server/services/extract.ts`

Intent extraction is the **foundation** of good recommendations. It converts natural language to structured queries.

### Extraction Targets

1. **Recipients** (who it's for)
2. **Occasions** (why you're giving)
3. **Interests** (what they like)
4. **Categories** (product types)
5. **Values** (ethical/aesthetic preferences)
6. **Budget** (price constraints)
7. **Emotional State** (urgency, anxiety, excitement)

### Example Extraction

**Input**: "I need a birthday gift for my friend who loves fishing and sustainability, under $100, it's kind of urgent"

**Output**:
```typescript
{
  recipientKey: 'friend',
  occasion: 'birthday',
  budgetMax: 100,
  interests: ['fishing'],
  values: ['sustainable'],
  categories: ['Sports & Outdoors', 'Art & Crafts'],  // Inferred from fishing
  emotional: {
    urgency: true,
    anxiety: false,
    excitement: false,
    uncertainty: false,
    celebration: true
  }
}
```

### Interest Mappings

**Critical Pattern**: Interests map to **multiple categories** for cross-category discovery.

```typescript
const INTEREST_MAPPINGS: Record<string, {
  categories: string[],
  interests: string[],
  keywords: RegExp
}> = {
  fishing: {
    categories: ['Sports & Outdoors', 'Art & Crafts'],  // NOT just Sports!
    interests: ['fishing'],
    keywords: /\b(fish|fishing|fisherman|angler|angling|lure|bait|tackle|rod|reel|catch)\b/i
  },
  // ... 20+ more mappings
};
```

**Why Multiple Categories?**
- "Fishing" could mean fishing gear (Sports) OR a lure making kit (Art & Crafts)
- Cross-category discovery finds unexpected but perfect gifts
- Example: "Lure Making Kit" in Art & Crafts matches "fishing" query

**LLM Instruction for Adding Interests**:
1. Think broadly about what categories relate to this interest
2. Include both **direct** (fishing → Sports) and **creative** (fishing → Art & Crafts) categories
3. Add comprehensive keyword patterns (synonyms, related terms, tools, activities)
4. Consider verbs, nouns, and adjectives ("fish", "fishing", "fisherman", "angling")

### Budget Extraction

**Patterns Supported**:
```typescript
// Under/max patterns
"under $50" → budgetMax: 50
"max $100" → budgetMax: 100
"no more than 75" → budgetMax: 75

// Range patterns
"$20-$50" → budgetMin: 20, budgetMax: 50
"between 30 and 60" → budgetMin: 30, budgetMax: 60
"20 to 40 dollars" → budgetMin: 20, budgetMax: 40
```

**LLM Instruction**: Always extract both min and max when a range is given. Default to budgetMax only for "under X" patterns.

### Value Extraction

**Supported Values** (map to product_facets.value):
```typescript
const VALUE_SYNONYMS: Record<string, string[]> = {
  sustainable: ["eco", "eco-friendly", "sustainable", "green", "earth-friendly"],
  handmade: ["handmade", "hand-crafted", "artisan", "artisanal"],
  organic: ["organic"],
  fair_trade: ["fair trade", "fair-trade"],
  recycled: ["recycled", "upcycled"],
  personalized: ["personalized", "custom", "customized", "engraved"],
  luxury: ["luxury", "premium", "high-end", "upscale"],
  minimalist: ["minimalist", "minimal", "simple", "clean"],
  quirky: ["quirky", "unique", "unusual", "creative", "original"],
  practical: ["practical", "useful", "functional"],
};
```

**Common Mistake**: Don't confuse **budget** with **values**. "Cheap" and "affordable" are budget constraints, not product values.

### Emotional State Detection

```typescript
interface EmotionalState {
  anxiety: boolean;      // "I don't know what to get"
  excitement: boolean;   // "I can't wait to give this!"
  uncertainty: boolean;  // "Maybe?", "Not sure"
  urgency: boolean;      // "Need ASAP", "it's tomorrow"
  celebration: boolean;  // Birthday, wedding, achievement
}
```

**Use Cases**:
- **Urgency**: Filter for fast shipping, digital products, gift cards
- **Anxiety**: Provide more explanation, suggest safe bets, offer curated sets
- **Uncertainty**: Ask clarifying questions, show diverse options
- **Celebration**: Boost festive, special-occasion products
- **Excitement**: Match the energy with fun, bold recommendations

**LLM Instruction**: Use emotional state to adjust **tone** (supportive vs celebratory) and **filtering** (urgent → fast delivery).

---

## Semantic Search & Vector Retrieval

### File: `src/server/adapters/fivedb/vector.qdrant.ts`

### Embedding Strategy

Products are embedded using OpenAI's `text-embedding-3-small` (1536 dimensions):

```typescript
function buildProductEmbeddingText(product: Product): string {
  const parts = [
    product.title,
    product.description || '',
    product.category || '',
    product.vendor || '',
    product.tags?.join(' ') || ''
  ];
  return parts.filter(Boolean).join(' | ');
}

const embedding = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: embeddingText
});
```

**LLM Instruction for Better Embeddings**:
- Include **all relevant text** (title, description, category, vendor, tags)
- Use **separator** (` | `) to distinguish fields for the model
- **Don't** include IDs, prices, or other non-semantic data
- **Future enhancement**: Add top product reviews for richer context

### Query Construction

**Good Query** (semantically rich):
```typescript
query: "fishing outdoor sports equipment tackle lure"
```

**Bad Query** (sparse):
```typescript
query: "fishing"
```

**LLM Instruction**: Build queries from:
- User's original text
- Extracted interests (add synonyms)
- Inferred categories
- **Example**: "friend who loves fishing" → query: "fishing sports & outdoors"

### Vector Search Filters

**Current Approach** (budget only):
```typescript
await vectorIndex.search(qText, vectorLimit, {
  budgetMin: input.query?.budgetMin,
  budgetMax: input.query?.budgetMax,
  // NO category filter - semantic search finds cross-category matches
});
```

**Why No Category Filter?**
- Semantic search excels at finding conceptually related products
- Rigid category filters prevent serendipitous discovery
- Example: "Lure Making Kit" (Art & Crafts) wouldn't match "fishing" if we filtered to Sports

**LLM Instruction**: Only use **hard constraints** as filters (budget, availability). Use **soft preferences** (category, interests) as scoring boosts instead.

### UUID Conversion for Qdrant

Qdrant requires UUID or small integer IDs. Product IDs are large integers (e.g., 8739924738283).

**Solution** (vector.qdrant.ts:19-31):
```typescript
private idToUUID(id: string): string {
  const hex = BigInt(id).toString(16).padStart(32, '0');
  return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20, 32)}`;
}

private uuidToID(uuid: string): string {
  const hex = uuid.replace(/-/g, '');
  return BigInt('0x' + hex).toString();
}
```

**LLM Instruction**: Always convert product IDs to UUID when upserting to Qdrant, and convert back when retrieving.

---

## Facet-Based Scoring

### Facet Schema

```sql
CREATE TABLE product_facets (
  product_id TEXT NOT NULL,
  facet_key TEXT NOT NULL,
  facet_value TEXT NOT NULL,
  confidence NUMERIC(3,2) DEFAULT 1.0,
  PRIMARY KEY (product_id, facet_key, facet_value)
);
```

### Facet Keys

| Key | Purpose | Example Values |
|-----|---------|----------------|
| `recipient` | Who to gift this to | him, her, friend, mom, dad, colleague, kids |
| `occasion` | When to give this | birthday, wedding, anniversary, christmas, thank_you |
| `interest` | Hobbies/activities | fishing, cooking, gaming, gardening, art, music |
| `value` | Ethical/aesthetic values | sustainable, handmade, luxury, minimalist, quirky |
| `theme` | Visual/conceptual themes | rustic, modern, vintage, elegant, playful |

### Confidence Scores

Confidence (0.0 - 1.0) represents **how certain** we are this facet applies:

- **1.0**: Explicit (product title: "Men's Fishing Rod" → recipient:him = 1.0)
- **0.8-0.9**: Strong inference (description mentions "perfect for him" → recipient:him = 0.85)
- **0.5-0.7**: Moderate inference (in "Father's Day" collection → recipient:dad = 0.6)
- **0.3-0.4**: Weak inference (masculine colors → recipient:him = 0.35)

**LLM Instruction**: When extracting facets, assign confidence based on evidence strength. Multiply boost by confidence to avoid over-weighting uncertain facets.

### Facet Matching Logic

**Exact Match**:
```typescript
facets.find(f => f.key === 'recipient' && f.value === 'friend')
// ✅ Matches: "friend"
// ❌ Doesn't match: "best_friend", "close_friend"
```

**Partial Match** (recommended for flexibility):
```typescript
facets.find(f => f.key === 'recipient' && f.value.includes('friend'))
// ✅ Matches: "friend", "best_friend", "close_friend"
```

**LLM Instruction**: Use `.includes()` for recipient/occasion matching to catch variations. Use exact match for interests/values where precision matters.

### Multi-Facet Products

Products can have **multiple values per key**:

```typescript
// Example: A sustainable, handmade fishing lure kit
{
  product_id: '8739924738283',
  facets: [
    { key: 'recipient', value: 'him', confidence: 0.85 },
    { key: 'recipient', value: 'friend', confidence: 0.90 },
    { key: 'interest', value: 'fishing', confidence: 0.95 },
    { key: 'interest', value: 'art', confidence: 0.70 },
    { key: 'value', value: 'handmade', confidence: 1.0 },
    { key: 'value', value: 'sustainable', confidence: 0.80 },
  ]
}
```

**Scoring** (stacks for multiple matches):
```typescript
// User query: interests=["fishing", "art"], values=["handmade"]
score += 0.3 * 0.95  // fishing match
score += 0.3 * 0.70  // art match
score += 0.2 * 1.0   // handmade match
// Total boost: 0.485
```

**LLM Instruction**: When a product matches multiple user interests/values, it should rank higher (signals it's a great fit).

---

## Reranking for Quality

### Why Rerank?

Vector search is **recall-focused** (find all potentially relevant items). Reranking is **precision-focused** (rank the best items first).

**Vector Search Strengths**:
- Fast (ANN search in milliseconds)
- Semantic understanding
- Scalable to millions of products

**Vector Search Weaknesses**:
- May retrieve loosely related items
- Doesn't understand nuanced query intent
- Scores are cosine similarity (not relevance)

**Cohere Reranking Strengths**:
- Trained specifically for query-document matching
- Understands complex queries ("birthday gift for friend who loves fishing and sustainability")
- Accounts for query structure, not just keywords

### Reranking Model

**Model**: `rerank-english-v3.0` (Cohere's latest)

**Input**:
- **Query**: User's full natural language query
- **Documents**: Product text (title | description | category | vendor)
- **TopN**: How many results to return (we use 15)

**Output**:
- **Relevance scores** (0.0 - 1.0)
- **Re-ordered indices** (best matches first)

### Score Fusion

We combine semantic and rerank scores:

```typescript
finalScore = semanticScore * 0.3 + rerankScore * 0.7
```

**Why 30/70?**
- Reranking is more accurate for final ranking (higher weight)
- Semantic score preserves some diversity (prevents reranker from being too narrow)

**LLM Instruction**: Adjust weights if you observe:
- **Too narrow results**: Increase semantic weight (e.g., 0.5/0.5)
- **Poor relevance**: Increase rerank weight (e.g., 0.2/0.8)

### Fallback Handling

```typescript
try {
  items = await this.reranker.rerank(qText, items, limit);
} catch (error: any) {
  console.warn('[recommend] reranking failed:', error.message);
  // Continue with original ranking
}
```

**LLM Instruction**: Always handle reranking failures gracefully. Return semantic-only results rather than breaking the user experience.

---

## Rationale Generation

### Purpose

Rationales **build trust** and **reduce decision anxiety** by explaining why each product is recommended.

**Bad Rationale**:
> "A good choice."

**Good Rationale**:
> "Why: Perfect for birthdays. Great gift for a friend. Ideal for fishing enthusiasts. Within your $100 budget."

### Rationale Structure

```typescript
const parts: string[] = [];

// 1. Occasion (if matched)
if (occasionMatch) {
  parts.push(`Perfect for ${input.occasion}`);
}

// 2. Recipient (if matched)
if (recipientMatch) {
  parts.push(`Great gift ${recipientMatch.value.replace(/_/g, ' ')}`);
}

// 3. Interests (if matched)
if (interestMatches.length > 0) {
  const names = interestMatches.map(f => f.value).join(' & ');
  parts.push(`Ideal for ${names} enthusiasts`);
}

// 4. Values (if matched)
if (valueMatches.length > 0) {
  const names = valueMatches.map(f => f.value.replace(/_/g, ' ')).join(' & ');
  parts.push(`${names} choice`);
}

// 5. Budget (if within range)
if (withinBudget) {
  parts.push(`Within your $${budgetMax} budget`);
}

// Combine
return `Why: ${parts.join('. ')}.`;
```

### Rationale Best Practices

1. **Be Specific**
   - ❌ "Great for occasions"
   - ✅ "Perfect for birthdays"

2. **Be Personal**
   - ❌ "For friends"
   - ✅ "Great gift for a friend"

3. **Stack Signals** (up to 5 parts)
   - Occasion + Recipient + Interest + Value + Budget
   - Example: "Perfect for birthdays. Great gift for a friend. Ideal for fishing enthusiasts. Handmade choice. Within your $100 budget."

4. **Use Active Language**
   - ❌ "This is sustainable"
   - ✅ "Sustainable choice"

5. **Normalize Values** (replace underscores)
   - ❌ "fair_trade choice"
   - ✅ "fair trade choice"

6. **Always Have a Fallback**
   ```typescript
   if (parts.length === 0) {
     parts.push('A thoughtful choice based on your preferences');
   }
   ```

### Tone Guidelines

| Emotional State | Tone |
|-----------------|------|
| Urgency | Concise, action-oriented ("Fast delivery available") |
| Anxiety | Supportive, reassuring ("A safe bet", "Highly rated") |
| Excitement | Enthusiastic, celebratory ("Perfect for celebrating!") |
| Uncertainty | Educational, explanatory (longer rationales) |
| Neutral | Professional, clear (standard format) |

**LLM Instruction**: Adjust rationale tone based on extracted emotional state for better user experience.

---

## Context Management

### Context Merging

**Flow**:
1. Extract context from current message
2. Retrieve stored context from `user_context` table
3. **Merge** (current takes precedence)
4. Use merged context for recommendations
5. Store updated context for next session

```typescript
// 1. Extract from current message
const extracted = extractAll(userMessage);

// 2. Retrieve stored context
const stored = await pool.query('SELECT data FROM user_context WHERE user_id = $1', [userId]);

// 3. Merge
const merged = {
  budgetMin: extracted.budgetMin ?? stored.budgetMin,
  budgetMax: extracted.budgetMax ?? stored.budgetMax,
  categories: [...new Set([...(extracted.categories || []), ...(stored.categories || [])])],
  values: [...new Set([...(extracted.values || []), ...(stored.values || [])])],
  interests: [...new Set([...(extracted.interests || []), ...(stored.interests || [])])],
  occasion: extracted.occasion ?? stored.occasion,
  recipientKey: extracted.recipientKey ?? stored.recipientKey,
};

// 4. Use for recommendations
const results = await recommend(merged);

// 5. Store updated context
await pool.query(
  'INSERT INTO user_context (user_id, data) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET data = $2',
  [userId, JSON.stringify(merged)]
);
```

### Context Persistence Policy

**Store**:
- Budget preferences (min/max)
- Favorite categories
- Personal values (sustainable, handmade, etc.)
- Common recipients (friend, mom, etc.)
- Common interests (fishing, cooking, etc.)

**Don't Store** (privacy):
- Specific product IDs (unless user explicitly saves them)
- Full conversation transcripts (only summaries)
- Exact gift recipients' names (use keys: "friend", "mom")
- Payment information

**LLM Instruction**: Be privacy-conscious. Store preferences, not personal details.

### Context Transparency

Always show users what context is being used:

```typescript
// In response
{
  recommendations: [...],
  contextUsed: {
    budgetMax: 100,
    recipient: 'friend',
    interests: ['fishing'],
    values: ['sustainable']
  },
  message: "Based on your preferences: budget up to $100, shopping for a friend who loves fishing, focusing on sustainable options."
}
```

**LLM Instruction**: Display context used in a friendly, concise summary. Let users know they can clear/modify stored preferences.

---

## Common Patterns & Edge Cases

### Pattern 1: No Results

**Scenario**: Query is too specific (e.g., "vegan leather fishing tackle box under $10")

**Handling**:
1. Try removing least important constraints (values first, then interests)
2. Expand budget range (+20%)
3. Show related products with explanation

```typescript
if (items.length === 0) {
  // Retry without values
  items = await recommend({ ...input, values: [] });

  if (items.length === 0) {
    // Retry with expanded budget
    items = await recommend({
      ...input,
      budgetMax: input.budgetMax * 1.2,
      values: []
    });
  }

  // Explain to user
  message = "We didn't find exact matches, so here are some related options:";
}
```

### Pattern 2: Ambiguous Recipients

**Scenario**: "Gift for someone who loves fishing"

**Extraction**:
```typescript
{
  recipientKey: undefined,  // Unclear: him, her, friend?
  interests: ['fishing']
}
```

**Handling**:
- Don't filter by recipient
- Show diverse results (products for him, her, kids)
- Optionally ask clarifying question: "Who are you shopping for?"

### Pattern 3: Multiple Occasions

**Scenario**: "Birthday and anniversary gift"

**Extraction**:
```typescript
{
  occasion: 'birthday',  // Pick primary
  occasions: ['birthday', 'anniversary']
}
```

**Handling**:
- Use primary occasion for display
- Boost products matching **any** of the occasions
- Rationale: "Perfect for birthdays and anniversaries"

### Pattern 4: Conflicting Preferences

**Scenario**: "Luxury sustainable gift under $20"

**Conflict**: Luxury products are rarely under $20

**Handling**:
1. **Budget is king** (hard constraint)
2. Drop "luxury" value
3. Keep "sustainable" value
4. Explain: "Here are sustainable options under $20:"

**LLM Instruction**: Budget is always a hard constraint. Values are preferences (can be dropped if conflicting).

### Pattern 5: No Interest Match

**Scenario**: User asks for "cooking gifts" but no products have `interest=cooking` facet

**Handling**:
- **Semantic search saves the day**
- Vector embeddings will match "cooking" → kitchen tools, cookbooks, utensils
- Even without explicit facets, good results are returned
- Rationale uses category instead: "Matches Kitchen & Dining"

**LLM Instruction**: This is why we use hybrid search. Semantic search finds relevant products even when facets are missing.

---

## Performance Optimization

### Latency Budget

**Target**: <500ms total recommendation pipeline

**Breakdown**:
- Intent extraction: <50ms
- Vector search: <100ms
- Facet boosting: <50ms
- Reranking: <200ms
- Rationale generation: <50ms
- **Buffer**: 50ms

### Optimization Techniques

#### 1. Parallel Facet Queries

**Before** (serial):
```typescript
for (const item of items) {
  item.facets = await getFacets(item.product.id);  // 30 items × 10ms = 300ms
}
```

**After** (parallel):
```typescript
const productIds = items.map(it => it.product.id);
const facetRes = await pool.query(
  'SELECT product_id, facet_key, facet_value, confidence FROM product_facets WHERE product_id = ANY($1)',
  [productIds]
);  // Single query: ~10ms
```

**Savings**: 290ms

#### 2. Candidate Limiting

Don't rerank more candidates than necessary:

```typescript
const vectorLimit = Math.min(limit * 3, 30);  // Cap at 30
```

**Why**: Reranking 100 items takes 400ms vs 30 items at 150ms

#### 3. Embedding Caching

Cache product embeddings (they don't change):

```typescript
// Store embeddings in Qdrant (already done)
// Don't re-embed products on every search
```

#### 4. Query Caching (Future)

For identical queries within 5 minutes, return cached results:

```typescript
const cacheKey = `rec:${hash(query)}:${userId}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

// ... run recommendation pipeline ...

await redis.setex(cacheKey, 300, JSON.stringify(results));  // 5min TTL
```

---

## Testing & Validation

### Unit Tests

Test individual components:

```typescript
describe('Intent Extraction', () => {
  it('should extract recipient from "gift for my friend"', () => {
    const extracted = extractRecipient("gift for my friend");
    expect(extracted).toBe('friend');
  });

  it('should extract budget from "under $50"', () => {
    const extracted = extractBudget("under $50");
    expect(extracted).toEqual({ budgetMax: 50 });
  });
});

describe('Facet Scoring', () => {
  it('should boost products matching occasion', () => {
    const item = { product, score: 0.5, facets: [{ key: 'occasion', value: 'birthday', confidence: 1.0 }] };
    const boosted = applyOccasionBoost(item, 'birthday');
    expect(boosted.score).toBe(0.9);  // 0.5 + 0.4
  });
});
```

### Integration Tests

Test full recommendation pipeline:

```typescript
describe('Recommendation Pipeline', () => {
  it('should return fishing products for "fishing gifts" query', async () => {
    const results = await recommend({
      query: { text: 'fishing gifts', limit: 10 }
    });

    expect(results.items.length).toBeGreaterThan(0);
    expect(results.items[0].product.title.toLowerCase()).toMatch(/fish|lure|tackle|rod|reel/);
  });

  it('should respect budget constraints', async () => {
    const results = await recommend({
      query: { text: 'gifts', budgetMax: 50, limit: 10 }
    });

    expect(results.items.every(it => it.product.price <= 50)).toBe(true);
  });
});
```

### User Testing

**Test Personas** (see `TEST_PERSONAS.md`):
1. **Budget-Conscious Shopper** (under $30)
2. **Last-Minute Gifter** (urgency = true)
3. **Eco-Conscious Buyer** (values = ["sustainable"])
4. **Hobby Enthusiast** (interests = ["fishing", "camping"])

**Metrics**:
- **Relevance**: 1-5 rating on how well recommendations match needs
- **Time to Decision**: How long until user finds a gift they like
- **Conversion Rate**: % of sessions ending in product click/purchase
- **Diversity**: Number of unique categories in top 10 results

### A/B Testing

Compare algorithm versions:

```typescript
// Control: Semantic search only
const controlResults = await recommendSemanticOnly(query);

// Treatment: Semantic + Reranking
const treatmentResults = await recommendWithReranking(query);

// Log both for comparison
await logExperiment({
  userId,
  variant: Math.random() > 0.5 ? 'control' : 'treatment',
  query,
  results: variant === 'control' ? controlResults : treatmentResults
});
```

**Evaluate**:
- Click-through rate (CTR)
- Position of clicked item (lower is better)
- User satisfaction ratings

---

## Summary: Key Principles for LLMs

### 1. **Semantic Understanding Over Keywords**
Use embeddings and reranking to find conceptual matches, not just keyword overlap.

### 2. **Multi-Signal Fusion**
Combine semantic similarity + facet matching + graph preferences for best results.

### 3. **Graceful Degradation**
Always have fallbacks: vector → keyword → defaults. Never return zero results.

### 4. **Cross-Category Discovery**
Don't silo products by category. "Fishing" can match Art & Crafts (lure kit) and Sports (rod).

### 5. **Explainability**
Every recommendation needs a clear, specific rationale explaining why it fits.

### 6. **Context is King**
Merge stored preferences with current query. Remember what users care about.

### 7. **Privacy First**
Store preferences, not personal details. Provide transparency and deletion paths.

### 8. **Measure Impact**
Track relevance, CTR, conversion, time-to-decision. Optimize based on data.

---

## Quick Reference

| Component | File | Purpose |
|-----------|------|---------|
| Recommendation Orchestration | `src/server/services/recommend.ts` | Main pipeline |
| Intent Extraction | `src/server/services/extract.ts` | NLP to structured query |
| Vector Search | `src/server/adapters/fivedb/vector.qdrant.ts` | Semantic retrieval |
| Reranking | `src/server/services/reranker.ts` | Cohere final ranking |
| Catalog Search | `src/server/adapters/fivedb/catalog.postgres.ts` | Keyword fallback |
| Graph Preferences | `src/server/adapters/fivedb/graph.neo4j.ts` | Relationship data |
| Chat Prompts | `src/server/services/prompts/chat.ts` | LLM conversation |

---

**For more details, see:**
- `PERSONALIZATION_RECOMMENDATIONS.md` - Future roadmap
- `FACETS.md` - Facet system details
- `AGENTS.md` - General agent guidelines
