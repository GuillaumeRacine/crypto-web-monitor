# Present-Agent: Complete Recommendation System Guide

**Last Updated:** 2025-10-07
**For:** Developers, LLMs, and Product Team
**Purpose:** Comprehensive guide to how the gift recommendation system works

---

## Table of Contents

1. [Product Vision & Goals](#1-product-vision--goals)
2. [System Architecture](#2-system-architecture)
3. [Recommendation Workflow](#3-recommendation-workflow)
4. [Context Gathering Strategy](#4-context-gathering-strategy)
5. [Scoring & Ranking Pipeline](#5-scoring--ranking-pipeline)
6. [Personalization Features](#6-personalization-features)
7. [UX Design Principles](#7-ux-design-principles)
8. [API Reference](#8-api-reference)
9. [Code Architecture](#9-code-architecture)
10. [Testing & Validation](#10-testing--validation)

---

## 1. Product Vision & Goals

### The Problem We're Solving

**78%** of people report gift-giving anxiety
**$75B** in unwanted gifts returned annually (US)
**10+ hours** average annual time spent searching for gifts
**43%** report gift disappointment damages relationships

**Root Cause:** Generic shopping engines (Amazon, Google) don't model WHO you're shopping for, WHAT they like, or WHY you're buying.

### Our Solution

**AI-powered relationship intelligence platform** that transforms gift-giving through:
- Deep personalization based on recipient relationships
- Conversational AI (voice + text) to understand context
- Memory that improves with each interaction
- **Sub-2-minute** path to confident suggestions

### Core Hypothesis

**Hybrid Intelligence > Pure Search:** A recommendation engine that layers context (recipient, occasion, values, interests) and learns from interactions will outperform generic product search by **>70%** on user preference tests.

**Memory Creates Compounding Value:** System improves measurably with each interaction, becoming intuitive and even proactive (**>30%** improvement in confidence/satisfaction).

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to Confident Choice | <2 minutes | From start to "I'll buy this" |
| Preference vs Amazon/Google | >70% | Blind A/B tests on identical tasks |
| Intention to Return | >50% | "Will you use this for next gift?" |
| Refinement Rate | <40% | % of conversations requiring "show me other options" |
| User Satisfaction | >70% | Post-recommendation survey (currently 30%) |
| Memory Lift | +30% | Improvement in confidence when using saved context |

---

## 2. System Architecture

### Five-Database Hybrid System

```
┌─────────────────────────────────────────────────────────────┐
│                         User Layer                           │
│  Web UI (Next.js) → Voice/Text Input → Chat Interface       │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                     API Layer (Node.js)                      │
│  /api/chat → Context Extraction → Recommendation Engine     │
└────────────────────────┬────────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          │                             │
┌─────────▼─────────┐         ┌────────▼──────────┐
│   PostgreSQL      │         │   Vector DB        │
│                   │         │  (Qdrant)          │
│ - Users           │         │ - Product          │
│ - Products        │         │   Embeddings       │
│ - Categories      │         │ - Semantic Search  │
│ - Facets          │         │   <100ms           │
│ - User Context    │         └────────────────────┘
│ - Conversations   │
│ - Feedback        │         ┌────────────────────┐
└───────────────────┘         │   Neo4j            │
                              │ (Graph DB)         │
          │                   │ - Relationships    │
          │                   │ - Gift Patterns    │
          │                   │ - LIKES edges      │
          │                   └────────────────────┘
          │
┌─────────▼─────────┐         ┌────────────────────┐
│   Redis           │         │   Event Store      │
│ - Sessions        │         │  (Future)          │
│ - Trending Cache  │         │ - Behavioral       │
│ - Real-time State │         │   History          │
└───────────────────┘         └────────────────────┘
```

### Tech Stack

**Frontend:**
- Next.js 14 (App Router)
- React 18
- TailwindCSS
- TypeScript

**Backend:**
- Node.js 18+
- TypeScript
- PostgreSQL 15
- Neo4j 5.x (optional)
- Qdrant Vector DB (optional)
- Redis (optional)

**AI/ML:**
- OpenAI GPT-4o-mini (conversation & reasoning)
- text-embedding-3-small (semantic search)
- Vector dimension: 1536
- Cohere Rerank API (optional, for reranking)

---

## 3. Recommendation Workflow

### Complete User Journey

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: User Input                                          │
├─────────────────────────────────────────────────────────────┤
│ User: "Gift for my mom, loves gardening, budget $50"       │
│                                                             │
│ System extracts:                                            │
│  - Recipient: "mother" (mapped to for_her, mom)           │
│  - Interests: ["gardening"]                                │
│  - Budget: $0-$50                                          │
│  - Occasion: (none detected)                               │
└─────────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ STEP 2: Context Validation (CRITICAL)                      │
├─────────────────────────────────────────────────────────────┤
│ Count context signals:                                      │
│  ✅ Budget: YES (1 signal)                                  │
│  ✅ Recipient: YES (2 signals) ← READY                     │
│  ✅ Interests: YES (3 signals)                              │
│  ❌ Occasion: NO                                            │
│                                                             │
│ RULE: Need minimum 2 signals to proceed                    │
│                                                             │
│ This example: 3 signals → READY TO RECOMMEND               │
└─────────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ STEP 3: Search & Retrieval                                 │
├─────────────────────────────────────────────────────────────┤
│ A. Semantic Vector Search (if Vector DB available)         │
│    - Query: "gardening gifts for mom"                      │
│    - Filters: price ≤ $50                                  │
│    - Limit: 30 candidates (3x final count)                │
│    - Returns: [{id, score}, ...]                           │
│                                                             │
│ B. Fallback: PostgreSQL Full-Text Search                   │
│    - Query: "gardening"                                    │
│    - WHERE: price <= 50                                    │
│    - ORDER BY: ts_rank                                     │
│    - LIMIT: 20                                             │
└─────────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ STEP 4: Facet Enrichment                                   │
├─────────────────────────────────────────────────────────────┤
│ Load facets from product_facets table:                     │
│                                                             │
│ Product A:                                                  │
│  - facet_key: "recipient", value: "for_her"                │
│  - facet_key: "interest", value: "gardening"               │
│  - facet_key: "occasion", value: "mother's day"            │
│  - facet_key: "value", value: "eco-friendly"               │
│                                                             │
│ Product B:                                                  │
│  - facet_key: "recipient", value: "for_her"                │
│  - facet_key: "interest", value: "home & garden"           │
└─────────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ STEP 5: Multi-Signal Scoring                               │
├─────────────────────────────────────────────────────────────┤
│ For each candidate product, calculate score:               │
│                                                             │
│ Base Score (from vector search): 0.65                      │
│                                                             │
│ + Facet Boosts:                                            │
│   ✅ Recipient match (for_her): +0.3                       │
│   ✅ Interest match (gardening): +0.3                      │
│   ✅ Occasion match (mother's day): +0.4                   │
│   ❌ No value match                                        │
│                                                             │
│ + Personalization Boosts:                                  │
│   ✅ Trending product: +0.2                                │
│   ✅ User embeddings similarity: +0.15                     │
│   ✅ Collaborative filtering: +0.1                         │
│   ❌ No recipient history                                  │
│                                                             │
│ Final Score: 0.65 + 1.0 + 0.45 = 2.10                     │
│                                                             │
│ Normalized: min(2.10, 1.0) = 1.0 (cap at 1.0)             │
└─────────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ STEP 6: Quality Filtering                                  │
├─────────────────────────────────────────────────────────────┤
│ After scoring, apply quality thresholds:                   │
│                                                             │
│ High Quality (score > 0.7): 4 products                     │
│ Medium Quality (0.5-0.7): 8 products                       │
│ Low Quality (< 0.5): 18 products                           │
│                                                             │
│ Selection Logic:                                            │
│  IF high_quality >= 3:                                     │
│    → Show top 5 high-quality products only                 │
│  ELSE IF high + medium >= 3:                               │
│    → Show all high + some medium (max 5)                   │
│  ELSE:                                                      │
│    → Show best available (max 5)                           │
│                                                             │
│ This example: 4 high-quality → Show top 4                  │
└─────────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ STEP 7: Diversity (MMR - Optional)                         │
├─────────────────────────────────────────────────────────────┤
│ Maximal Marginal Relevance:                                │
│  - Ensure products aren't too similar                      │
│  - Balance relevance vs diversity                          │
│  - λ = 0.7 (70% relevance, 30% diversity)                  │
│                                                             │
│ Before MMR: [Planter A, Planter B, Seeds, Planter C]       │
│ After MMR:  [Planter A, Seeds, Garden Tools, Book]         │
└─────────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│ STEP 8: Response Generation                                │
├─────────────────────────────────────────────────────────────┤
│ Calculate average score: 0.88 → "Strong matches"           │
│                                                             │
│ Response:                                                   │
│ "Nice—your mother! I found some great matches:"            │
│                                                             │
│ [Product Cards with:]                                       │
│  - Image                                                    │
│  - Title: "Ceramic Herb Planter Set"                       │
│  - Price: $45 with ✅ "In Budget" badge                    │
│  - 🎯 "88% Match" confidence score                         │
│  - ⭐ 4.8/5 (2,431 reviews) social proof                   │
│  - Rationale: "Perfect for gardeners, eco-friendly"        │
│  - 🔥 "Trending" badge (if applicable)                     │
│  - 📦 "Fast Ship" badge (if urgent request)                │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Context Gathering Strategy

### The Problem: Insufficient Context

**Bad Experience (Before Fix):**
```
User: "budget $50"
System: [Shows 5 random products ≤$50]
User: "show me cheaper options"
System: [Shows 5 more random products]
User: "these aren't what I'm looking for"
...repeat 3-4 times...
```

**Why This Is Bad:**
- No information about WHO it's for
- No information about WHAT they like
- Recommendations are essentially random
- High refinement rate (82%)
- Low satisfaction (30%)

### The Solution: Require Minimum Context

**Implementation:** `src/server/index.ts` lines 754-766

```typescript
// Define 4 context signals
const hasBudget = merged.budgetMin != null || merged.budgetMax != null;
const hasRecipient = !!recipientKey; // e.g., "mother", "sister", "colleague"
const hasInterests = (merged.categories?.length > 0) ||
                    (merged.interests?.length > 0) ||
                    (merged.values?.length > 0);
const hasOccasion = /birthday|anniversary|wedding|holiday/i.test(text) ||
                   !!merged.occasion;

// Count total signals
const contextSignals = [hasBudget, hasRecipient, hasInterests, hasOccasion]
  .filter(Boolean).length;

// CRITICAL RULE: Need at least 2 signals to proceed
const ready = contextSignals >= 2;
```

### Context Signal Matrix

| Scenario | Budget | Recipient | Interests | Occasion | Signals | Ready? | Action |
|----------|--------|-----------|-----------|----------|---------|--------|--------|
| "budget $50" | ✅ | ❌ | ❌ | ❌ | 1 | ❌ | Ask for recipient + interests |
| "gift for mom" | ❌ | ✅ | ❌ | ❌ | 1 | ❌ | Ask for budget + interests |
| "birthday gift" | ❌ | ❌ | ❌ | ✅ | 1 | ❌ | Ask for recipient + budget |
| "gift for mom, $50" | ✅ | ✅ | ❌ | ❌ | 2 | ✅ | **PROCEED** |
| "birthday, loves cooking" | ❌ | ❌ | ✅ | ✅ | 2 | ✅ | **PROCEED** |
| "mom's birthday, $50" | ✅ | ❌ | ❌ | ✅ | 2 | ✅ | **PROCEED** |
| "mom loves gardening, $50" | ✅ | ✅ | ✅ | ❌ | 3 | ✅ | **PROCEED** (high quality) |

### Intelligent Follow-Up Questions

**Implementation:** `src/server/index.ts` lines 811-857

#### Case 1: No Context (0 signals)
```
System: "Who's the gift for, and what budget are you thinking?"
```

#### Case 2: Only Budget (1 signal)
```
User: "budget $50"
System: "Got the budget! Who's the gift for? What are they into?"
```

#### Case 3: Only Recipient (1 signal)
```
User: "gift for my mom"
System: "Got it—shopping for your mom! What's your budget, and what are they interested in?"
```

#### Case 4: Only Interests (1 signal)
```
User: "someone who loves cooking"
System: "Nice! Who's the gift for, and what's your budget?"
```

#### Case 5: Only Occasion (1 signal)
```
User: "birthday gift"
System: "Perfect! Who's the gift for, and what's your budget?"
```

### Context Extraction Details

**Budget Extraction** (`src/server/index.ts` lines 616-656):
- "between $20 and $50" → min: 20, max: 50
- "$30-40" → min: 30, max: 40
- "under $100" → max: 100
- "around $50" → min: 40, max: 60 (±20%)
- "budget is $75" → max: 75
- "spend $40" → max: 40

**Recipient Extraction** (`src/server/services/extract.ts`):
- Maps natural language to recipient keys
- "my mom" → "mother"
- "my sister" → "sister"
- "a colleague" → "colleague"
- "my wife" → "wife"

**Interests Extraction**:
- Pattern matching for categories: "loves cooking" → ["cooking", "kitchen"]
- "into tech" → ["technology", "gadgets"]
- "enjoys gardening" → ["gardening", "plants"]

**Occasion Detection**:
- Keywords: birthday, anniversary, wedding, holiday, valentine, thank, graduation, baby, diwali, christmas, hanukkah, eid
- Stored in context for future reference

---

## 5. Scoring & Ranking Pipeline

### Multi-Signal Scoring Algorithm

**Implementation:** `src/server/services/recommend.ts` lines 99-200

```typescript
// Starting point: Base score from vector search or keyword match
let score = item.baseScore; // e.g., 0.65

// SIGNAL 1: Facet Matching
// Occasion match: +0.4 × confidence
if (input.occasion) {
  const match = facets.find(f =>
    f.key === 'occasion' && f.value.includes(input.occasion)
  );
  if (match) score += 0.4 * match.confidence;
}

// Recipient match: +0.3 × confidence
if (input.recipientKey) {
  const match = facets.find(f =>
    f.key === 'recipient' && f.value.includes(recipientMapping[input.recipientKey])
  );
  if (match) score += 0.3 * match.confidence;
}

// Interest matches: +0.3 × confidence (can stack)
if (input.interests) {
  const matches = facets.filter(f =>
    f.key === 'interest' && input.interests.includes(f.value)
  );
  score += matches.reduce((sum, m) => sum + (0.3 * m.confidence), 0);
}

// Value matches: +0.2 × confidence
if (input.values) {
  const matches = facets.filter(f =>
    f.key === 'value' && input.values.includes(f.value)
  );
  score += matches.reduce((sum, m) => sum + (0.2 * m.confidence), 0);
}

// SIGNAL 2: Trending Boost
// From Redis cache, products with high recent activity get boosted
if (trendingCache.has(product.id)) {
  score += 0.2;
}

// SIGNAL 3: Occasion Detection Boost
// If current date is near occasion (e.g., Mother's Day approaching)
const occasionBoost = getCurrentOccasion(product.facets);
if (occasionBoost > 0) {
  score += 0.5 * occasionBoost; // Up to +0.5
}

// SIGNAL 4: User Embeddings Similarity
// Compare product embedding to user's learned preferences
if (userEmbedding) {
  const similarity = cosineSimilarity(productEmbedding, userEmbedding);
  score += 0.3 * similarity; // Up to +0.3
}

// SIGNAL 5: Collaborative Filtering
// Users who liked similar products also liked this
if (collaborativeScore) {
  score += 0.25 * collaborativeScore; // Up to +0.25
}

// SIGNAL 6: Recipient Learning
// If we've successfully recommended to this recipient before
if (recipientHistory) {
  const recipientScore = getRecipientAffinity(product, recipientHistory);
  score += 0.35 * recipientScore; // Up to +0.35
}

// SIGNAL 7: Purchase History
// User previously bought similar items
if (purchaseHistory) {
  const historyScore = getPurchaseAffinity(product, purchaseHistory);
  score += 0.2 * historyScore; // Up to +0.2
}

// Cap final score at 1.0
return Math.min(score, 1.0);
```

### Score Breakdown Example

**Product:** "Ceramic Herb Planter Set" for mom who loves gardening, $45

```
Base Score (vector search):           0.65

Facet Boosts:
  + Occasion (Mother's Day):          +0.40 (0.4 × 1.0 confidence)
  + Recipient (for_her):              +0.30 (0.3 × 1.0 confidence)
  + Interest (gardening):             +0.30 (0.3 × 1.0 confidence)
  + Value (eco-friendly):             +0.20 (0.2 × 1.0 confidence)
                                      ──────
Subtotal after facets:                1.85

Personalization Boosts:
  + Trending (popular this week):     +0.20
  + Occasion proximity:               +0.25 (Mother's Day in 2 weeks)
  + User embeddings:                  +0.15
  + Collaborative filtering:          +0.10
                                      ──────
Total before cap:                     2.55
Final score (capped):                 1.00
```

### Quality Thresholds

```typescript
// High quality: score > 0.7
// Medium quality: 0.5 < score <= 0.7
// Low quality: score <= 0.5

const highQuality = items.filter(i => i.score > 0.7);
const mediumQuality = items.filter(i => i.score > 0.5 && i.score <= 0.7);

if (highQuality.length >= 3) {
  // Show only high quality, max 5
  return highQuality.slice(0, 5);
} else if (highQuality.length + mediumQuality.length >= 3) {
  // Show high + some medium, max 5
  return [...highQuality, ...mediumQuality].slice(0, 5);
} else {
  // Show what we have, max 5
  return items.slice(0, 5);
}
```

**Why This Matters:**
- Don't show 5 products just to fill a quota
- If we only have 2 great matches, show 2 (not 5 mediocre ones)
- Better to show fewer high-quality recommendations than many weak ones
- Transparency: "I found a few options" vs "I found some great matches"

---

## 6. Personalization Features

### Feature Matrix

| Feature | Status | Impact | Location |
|---------|--------|--------|----------|
| Session Tracking | ✅ Implemented | Learns within session | `src/server/services/session.ts` |
| Trending Detection | ✅ Implemented | +0.2 boost | `src/server/services/trending.ts` |
| Occasion Awareness | ✅ Implemented | +0.5 boost | `src/server/services/occasion-detector.ts` |
| LLM Facet Extraction | ✅ Implemented | Enriches product data | `scripts/auto-facet-extraction.ts` |
| User Embeddings | ✅ Implemented | +0.3 boost | `src/server/services/embeddings.ts` |
| Collaborative Filtering | ✅ Implemented | +0.25 boost | `src/server/services/collaborative.ts` |
| Recipient Learning | ✅ Implemented | +0.35 boost | `src/server/services/recipient-learning.ts` |
| Purchase History | ✅ Implemented | +0.2 boost | `src/server/services/purchase-history.ts` |
| Enhanced Embeddings | ✅ Implemented | Better semantic search | `src/server/services/embeddings.ts` |
| MMR Diversity | ✅ Implemented | Prevents similar items | `src/server/services/diversity.ts` |
| A/B Testing | ✅ Implemented | Thompson Sampling | `src/server/services/ab-testing.ts` |

### 1. Session Tracking

**Purpose:** Learn from user behavior within a single session

**How It Works:**
```typescript
// Track viewed products
sessionStore.trackView(sessionId, productId);

// Track clicked products
sessionStore.trackClick(sessionId, productId);

// Track abandoned products (viewed but not clicked)
sessionStore.trackAbandon(sessionId, productId);

// Infer preferences from session behavior
const sessionContext = sessionStore.getRecommendationContext(sessionId);
// Returns: {
//   viewedProducts: [...],
//   clickedProducts: [...],
//   inferredCategories: ['Home & Garden', 'Gifts'],
//   inferredPriceRange: { min: 20, max: 80 }
// }
```

**Impact:** Better recommendations after 2-3 interactions in same session

---

### 2. Trending Detection

**Purpose:** Boost products with recent high activity

**How It Works:**
```typescript
// SQL query calculates trend score
WITH recent_activity AS (
  SELECT
    product_id,
    COUNT(*) as recent_count,
    MAX(created_at) as last_activity
  FROM events
  WHERE type IN ('product_view', 'product_click', 'purchase')
    AND created_at > NOW() - INTERVAL '7 days'
  GROUP BY product_id
),
historical_activity AS (
  SELECT
    product_id,
    COUNT(*) / 30.0 as avg_daily_count
  FROM events
  WHERE type IN ('product_view', 'product_click', 'purchase')
    AND created_at > NOW() - INTERVAL '30 days'
  GROUP BY product_id
)
SELECT
  r.product_id,
  CASE
    WHEN h.avg_daily_count > 0
    THEN (r.recent_count / 7.0) / h.avg_daily_count
    ELSE r.recent_count / 7.0
  END as trend_score
FROM recent_activity r
LEFT JOIN historical_activity h ON r.product_id = h.product_id
WHERE trend_score > 1.5  -- 50% above historical average
ORDER BY trend_score DESC
LIMIT 100;

// Cache in Redis for 5 minutes
redis.setex('trending:products', 300, JSON.stringify(trendingIds));
```

**Display:** Products get 🔥 "Trending" badge in UI

---

### 3. Occasion Awareness

**Purpose:** Detect upcoming occasions and boost relevant products

**How It Works:**
```typescript
const occasions = [
  { name: "Valentine's Day", date: '02-14', daysWindow: 14 },
  { name: "Mother's Day", date: '05-10', daysWindow: 21 }, // 2nd Sunday of May (approx)
  { name: "Father's Day", date: '06-15', daysWindow: 21 },
  { name: "Christmas", date: '12-25', daysWindow: 45 },
  // ... more occasions
];

function getCurrentOccasion(): { occasion: string; confidence: number; message: string } {
  const today = new Date();

  for (const occ of occasions) {
    const occDate = new Date(today.getFullYear(), ...parseDate(occ.date));
    const daysUntil = Math.round((occDate - today) / (1000 * 60 * 60 * 24));

    if (daysUntil >= 0 && daysUntil <= occ.daysWindow) {
      return {
        occasion: occ.name,
        confidence: 1 - (daysUntil / occ.daysWindow), // Closer = higher confidence
        message: `🎁 ${occ.name} is coming up in ${daysUntil} days!`
      };
    }
  }

  return { occasion: null, confidence: 0, message: null };
}
```

**Impact:**
- Displays banner: "🎁 Mother's Day is coming up in 12 days!"
- Boosts products with `occasion: "mother's day"` facet by +0.5
- Confidence increases as date approaches

---

### 4. LLM Facet Extraction

**Purpose:** Automatically extract gift-relevant attributes from product descriptions

**Script:** `scripts/auto-facet-extraction.ts`

**How It Works:**
```typescript
// For each product, send to Claude
const prompt = `
Analyze this product and extract gift-relevant facets:

Title: "${product.title}"
Description: "${product.description}"
Category: "${product.category}"

Extract these facets:
1. recipient: Who is this gift for? (for_her, for_him, for_kids, for_couples, etc.)
2. occasion: What occasions is this suitable for? (birthday, anniversary, wedding, etc.)
3. interest: What interests/hobbies does this match? (cooking, gardening, tech, etc.)
4. value: What values does this represent? (eco-friendly, handmade, luxury, etc.)
5. theme: What themes/aesthetics? (modern, rustic, romantic, etc.)
6. price_band: What price category? (budget, mid-range, premium, luxury)

Return as JSON array of {facet_key, facet_value, confidence}.
`;

const response = await anthropic.messages.create({
  model: 'claude-3-haiku-20240307',
  messages: [{ role: 'user', content: prompt }],
  max_tokens: 500
});

// Parse and store facets
const facets = JSON.parse(response.content[0].text);
for (const facet of facets) {
  await db.query(`
    INSERT INTO product_facets (product_id, facet_key, facet_value, confidence, source)
    VALUES ($1, $2, $3, $4, 'llm')
    ON CONFLICT (product_id, facet_key, facet_value)
    DO UPDATE SET confidence = EXCLUDED.confidence
  `, [product.id, facet.facet_key, facet.facet_value, facet.confidence]);
}
```

**Usage:**
```bash
# Extract facets for all products
npm run extract:facets

# Extract for specific product
npm run extract:facets -- --product-id abc123

# Extract for first 100 products
npm run extract:facets -- --limit 100
```

**Why This Matters:** Dramatically improves recommendation quality by enriching product data with gift-relevant attributes that aren't in original descriptions.

---

### 5-10. Advanced Personalization

Detailed in `PERSONALIZATION_RECOMMENDATIONS.md`. Summary:

- **User Embeddings:** Vector representation of user preferences weighted by ratings
- **Collaborative Filtering:** Jaccard similarity for user-user and item-item
- **Recipient Learning:** Learn successful gift patterns per recipient
- **Purchase History:** Boost similar to previously purchased items
- **Enhanced Embeddings:** Include facets in product embeddings
- **MMR Diversity:** Balance relevance vs variety (λ=0.7)

---

## 7. UX Design Principles

### Core UX Improvements Implemented

| Priority | Fix | Impact | Status |
|----------|-----|--------|--------|
| P100 | Performance Tracking | Visibility into bottlenecks | ✅ Implemented |
| P90 | Budget Transparency | 50% reduction in "cheaper" requests | ✅ Implemented |
| P85 | Urgency Detection | <5% shipping questions | ✅ Implemented |
| P75 | Social Proof & Confidence | Reduced anxiety | ✅ Implemented |
| P65 | Comparison Tools | Easier exploration | ✅ Implemented |

### 1. Budget Transparency (P90)

**Problem:** 80% of users asked for cheaper options despite stating budget

**Solution:**
```tsx
// Visual badges on product cards
{withinBudget && (
  <span className="bg-green-100 text-green-800">
    ✓ In Budget
  </span>
)}
{nearBudget && (
  <span className="bg-yellow-100 text-yellow-800">
    Near Budget
  </span>
)}
{showValue && withinBudget && (
  <div className="text-green-700">
    💰 Great Value
  </div>
)}
```

**Impact:** Clear visual cues prevent budget confusion

---

### 2. Urgency Detection (P85)

**Problem:** 14% of urgent shoppers asked about shipping separately

**Solution:**
```typescript
// Detect urgency keywords
const urgencyKeywords = [
  'asap', 'urgent', 'quickly', 'tomorrow', 'today',
  'this week', 'need it soon', 'rush', 'fast shipping'
];

const isUrgent = urgencyKeywords.some(kw =>
  userMessage.toLowerCase().includes(kw)
);

// Show banner and badges
if (isUrgent) {
  // Display: ⚡ Urgent Request Detected - Prioritizing fast shipping options
  // Add 📦 Fast Ship badge to all products
}
```

---

### 3. Social Proof & Confidence (P75)

**Problem:** 6% of anxious gift-givers needed reassurance

**Solution:**
```tsx
// Match confidence score
{matchScore > 0.7 && (
  <div className="bg-blue-50 border border-blue-100 p-2 rounded">
    <div className="font-semibold text-blue-900">
      🎯 {Math.round(matchScore * 100)}% Match
    </div>
    <div className="text-xs text-blue-700">
      High confidence based on preferences
    </div>
  </div>
)}

// Social proof
{isTrending && (
  <div className="text-xs text-gray-600">
    ⭐ 4.8/5 (2,431 reviews)
  </div>
)}
```

---

### 4. Comparison Tools (P65)

**Problem:** 82% refinement rate, users asking "show me other options"

**Solution:**
```tsx
// Comparison mode toggle
<Button onClick={() => setComparisonMode(true)}>
  Compare Options
</Button>

// Multi-select checkboxes on product cards
{comparisonMode && (
  <input
    type="checkbox"
    onChange={(e) => {
      if (e.target.checked) {
        selectedProducts.add(productId);
      } else {
        selectedProducts.delete(productId);
      }
    }}
  />
)}

// Quick filters
<button onClick={() => showCheaperOptions()}>
  Show Cheaper Options
</button>
<button onClick={() => showBestMatches()}>
  Show Best Matches
</button>
```

---

### Quality-Aware Messaging

**Implementation:** Response messages reflect match quality

```typescript
const avgScore = filtered.reduce((sum, i) => sum + i.score, 0) / filtered.length;

if (avgScore > 0.7) {
  // Strong matches
  reply = "I found some great matches:";
} else if (filtered.length < 3) {
  // Limited results
  reply = "I found a few options that might work—want me to refine the search?";
} else {
  // Medium quality
  reply = "Here are some ideas:";
}
```

**Why This Matters:** Sets appropriate expectations and invites refinement when needed.

---

## 8. API Reference

### Core Endpoints

#### POST /api/chat

**Purpose:** Main conversational recommendation endpoint

**Request:**
```json
{
  "message": "Gift for my mom who loves gardening, budget $50"
}
```

**Response (Not Ready - Needs More Context):**
```json
{
  "reply": "Got the budget! Who's the gift for? What are they into?"
}
```

**Response (Ready - With Recommendations):**
```json
{
  "reply": "Nice—your mother! I found some great matches:",
  "contextSummary": "Using your context (recipient: mother; budget: —–$50; interests: gardening)",
  "items": [
    {
      "product": {
        "id": "prod_123",
        "title": "Ceramic Herb Planter Set",
        "price": 45,
        "currency": "USD",
        "imageUrl": "https://...",
        "category": "Home & Garden",
        "productUrl": "https://..."
      },
      "score": 0.88,
      "rationale": "Why: within your budget; matches your interests (gardening)"
    },
    // ... 2-4 more products
  ],
  "performanceMetrics": {
    "contextLoadMs": 120,
    "recommendationMs": 1680,
    "totalMs": 1800
  }
}
```

---

#### POST /api/recommend

**Purpose:** Direct recommendation endpoint (bypasses conversation)

**Request:**
```json
{
  "query": {
    "text": "gardening gifts",
    "budgetMin": 0,
    "budgetMax": 50,
    "categories": ["Home & Garden"],
    "interests": ["gardening"],
    "facets": {
      "recipient": "for_her",
      "occasion": "mother's day",
      "values": ["eco-friendly"]
    },
    "limit": 5
  },
  "occasion": "mother's day",
  "interests": ["gardening"],
  "recipientId": "user123:mother"
}
```

**Response:**
```json
{
  "items": [
    {
      "product": { /* same as above */ },
      "score": 0.88,
      "rationale": "Semantic match for mother's day."
    }
  ],
  "tookMs": 1680,
  "performanceMetrics": { /* same as above */ }
}
```

---

#### GET /api/search

**Purpose:** Direct product search (no personalization)

**Request:**
```
GET /api/search?text=planter&budgetMin=20&budgetMax=100&category=Home%20%26%20Garden&limit=5
```

**Response:**
```json
{
  "products": [
    {
      "id": "prod_123",
      "title": "Ceramic Herb Planter Set",
      "price": 45,
      "currency": "USD",
      "imageUrl": "https://...",
      "category": "Home & Garden",
      "productUrl": "https://..."
    }
  ],
  "total": 127
}
```

---

#### GET /api/products/:id

**Purpose:** Get product details with facets

**Response:**
```json
{
  "item": { /* product object */ },
  "facets": [
    {
      "facet_key": "recipient",
      "facet_value": "for_her",
      "confidence": 0.95,
      "source": "llm"
    },
    {
      "facet_key": "interest",
      "facet_value": "gardening",
      "confidence": 1.0,
      "source": "llm"
    }
  ],
  "suggestions": [
    {
      "suggested_category_id": 42,
      "confidence": 0.88,
      "status": "pending"
    }
  ],
  "additionalCategories": ["Gifts", "Mother's Day"]
}
```

---

#### GET /api/trending

**Purpose:** Get trending product IDs

**Response:**
```json
{
  "trendingIds": ["prod_123", "prod_456", "prod_789"]
}
```

---

#### GET /api/occasion

**Purpose:** Get current occasion information

**Response:**
```json
{
  "occasion": "Mother's Day",
  "confidence": 0.75,
  "daysUntil": 12,
  "message": "🎁 Mother's Day is coming up in 12 days!"
}
```

---

## 9. Code Architecture

### Project Structure

```
Present-Agent/
├── src/
│   ├── server/                  # Backend API
│   │   ├── index.ts            # Main server entry (1000+ lines)
│   │   ├── types.ts            # TypeScript types
│   │   ├── services/           # Business logic
│   │   │   ├── catalog.ts      # Product catalog (Postgres)
│   │   │   ├── recommend.ts    # Recommendation engine ⭐
│   │   │   ├── embeddings.ts   # Vector embeddings
│   │   │   ├── extract.ts      # Context extraction
│   │   │   ├── session.ts      # Session tracking
│   │   │   ├── trending.ts     # Trending detection
│   │   │   ├── occasion-detector.ts # Occasion awareness
│   │   │   ├── collaborative.ts # Collaborative filtering
│   │   │   ├── recipient-learning.ts # Recipient patterns
│   │   │   ├── diversity.ts    # MMR diversity
│   │   │   ├── ab-testing.ts   # A/B testing framework
│   │   │   └── reranker.ts     # Cohere reranking
│   │   └── adapters/           # Database adapters
│   │       ├── postgres.ts     # PostgreSQL
│   │       ├── neo4j.ts        # Neo4j (graph)
│   │       ├── qdrant.ts       # Qdrant (vector)
│   │       └── redis.ts        # Redis (cache)
│   └── web/                    # Frontend (Next.js)
│       ├── app/                # App router
│       │   ├── page.tsx        # Main chat interface ⭐
│       │   ├── products/       # Product pages
│       │   └── admin/          # Admin tools
│       ├── components/         # React components
│       │   ├── ProductCard.tsx # Product display ⭐
│       │   ├── MicButton.tsx   # Voice input
│       │   └── wishlist/       # Wishlist feature
│       └── lib/                # Client utilities
│           └── api.ts          # API client
├── scripts/                    # Utility scripts
│   ├── auto-facet-extraction.ts # LLM facet extraction ⭐
│   ├── test-personas.ts        # Test data
│   ├── run-conversation-tests.ts # UX testing
│   └── analyze-conversations.ts # UX analysis
├── docs/                       # Documentation
│   ├── LLM_RECOMMENDATION_GUIDE.md
│   ├── LLM_FACET_EXTRACTION_GUIDE.md
│   └── LLM_RATIONALE_GUIDE.md
├── db/                         # Database schemas
│   └── schema.sql              # PostgreSQL schema
├── docker-compose.yml          # Docker services
└── package.json                # Node.js config
```

### Key Files Deep Dive

#### 1. `src/server/index.ts` (Main Server)

**Lines 590-1100:** `/api/chat` endpoint - Core conversational logic

**Critical Sections:**
- **Lines 614-656:** Budget parsing (9 patterns)
- **Lines 662-720:** Context extraction (recipient, occasion, interests, values)
- **Lines 722-752:** Context merging (stored + current)
- **Lines 754-766:** Readiness check (REQUIRES 2+ SIGNALS) ⚠️ CRITICAL
- **Lines 777-857:** Follow-up question generation
- **Lines 886-963:** Recommendation generation
- **Lines 965-1024:** Quality-aware response generation

---

#### 2. `src/server/services/recommend.ts` (Recommendation Engine)

**Lines 30-200:** Main `recommend()` method

**Critical Sections:**
- **Lines 42-74:** Vector search with budget filters
- **Lines 76-88:** Fallback keyword search
- **Lines 90-97:** Default products if no matches
- **Lines 99-200:** Facet-aware scoring boosts
- **Lines 203-250:** Personalization signal integration
- **Lines 252-280:** MMR diversity (optional)

---

#### 3. `src/web/app/page.tsx` (Chat Interface)

**Lines 75-141:** `runChat()` function

**Critical Sections:**
- **Lines 80-83:** Urgency detection
- **Lines 96-119:** Rationale enrichment
- **Lines 121-123:** Message handling

**Lines 163-168:** Urgency banner
**Lines 186-264:** Product display with comparison tools

---

#### 4. `src/web/components/ProductCard.tsx` (Product Display)

**Lines 42-90:** Budget badges and quality indicators

**Critical Sections:**
- **Lines 42-44:** Budget status calculation
- **Lines 73-82:** Budget badges (In Budget, Near Budget)
- **Lines 86-90:** Value indicator
- **Lines 99-111:** Match confidence score
- **Lines 113-119:** Social proof

---

### Database Schema (PostgreSQL)

```sql
-- Core tables
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USD',
  image_url TEXT,
  product_url TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  vendor TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  -- Full-text search
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
  ) STORED
);

CREATE INDEX idx_products_search ON products USING GIN(search_vector);
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_category ON products(category_id);

CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Facets (gift attributes)
CREATE TABLE product_facets (
  id SERIAL PRIMARY KEY,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  facet_key TEXT NOT NULL, -- 'recipient', 'occasion', 'interest', 'value', etc.
  facet_value TEXT NOT NULL,
  confidence NUMERIC DEFAULT 1.0,
  source TEXT DEFAULT 'manual', -- 'manual', 'llm', 'inferred'
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(product_id, facet_key, facet_value)
);

CREATE INDEX idx_facets_product ON product_facets(product_id);
CREATE INDEX idx_facets_key_value ON product_facets(facet_key, facet_value);

-- User context (stored preferences)
CREATE TABLE user_context (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  data JSONB NOT NULL, -- {budgetMin, budgetMax, categories, interests, values, notes}
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE recipient_context (
  user_id TEXT REFERENCES users(id),
  recipient_key TEXT NOT NULL, -- 'mother', 'sister', 'colleague', etc.
  data JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, recipient_key)
);

-- Conversations & Messages
CREATE TABLE conversations (
  id SERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES conversations(id),
  role TEXT NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Feedback & Events
CREATE TABLE feedback (
  id SERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  product_id TEXT REFERENCES products(id),
  rating INTEGER, -- -1 (thumbs down) or 1 (thumbs up)
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL, -- 'product_view', 'product_click', 'purchase', 'category_auto_assign'
  payload JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_created ON events(created_at);
```

---

## 10. Testing & Validation

### Test Framework

**Location:** `scripts/`

#### 1. Conversation Simulator

**File:** `scripts/run-conversation-tests.ts`

**Purpose:** Simulate 50 realistic gift-finding conversations

**Usage:**
```bash
npm run test:conversations
```

**How It Works:**
```typescript
// 10 personas (busy mom, anxious gift-giver, minimalist, etc.)
// 15 scenarios (birthday, anniversary, urgent, etc.)
// Generates realistic conversation flows

for (let i = 0; i < 50; i++) {
  const persona = randomPersona();
  const scenario = randomScenario();

  const conversation = generateConversationFlow(persona, scenario);

  for (const userMessage of conversation) {
    const response = await callChatAPI(userMessage);

    // Track satisfaction indicators
    if (userMessage.includes('perfect')) satisfactionCount++;
    if (userMessage.includes('other options')) refinementCount++;
  }
}
```

**Output:** `test-results/conversations-[timestamp].json`

---

#### 2. UX Analysis

**File:** `scripts/analyze-conversations.ts`

**Purpose:** Automatically detect UX issues from conversations

**Usage:**
```bash
npm run analyze:ux
```

**How It Works:**
```typescript
// Analyze patterns
for (const conv of conversations) {
  // Check for slow responses
  if (turn.tookMs > 3000) {
    issues.push({
      category: 'slow_response_time',
      severity: 'critical',
      priority: 100
    });
  }

  // Check for budget concerns
  const budgetMentions = turns.filter(t =>
    t.message.includes('cheaper') || t.message.includes('affordable')
  );
  if (budgetMentions.length > 0) {
    issues.push({
      category: 'budget_mismatch',
      severity: 'high',
      priority: 90
    });
  }

  // Check for urgency confusion
  if (conv.isUrgent && turns.some(t => t.message.includes('shipping'))) {
    issues.push({
      category: 'urgency_shipping',
      severity: 'medium',
      priority: 85
    });
  }
}
```

**Output:** `test-results/ux-analysis-[timestamp].md`

---

### Manual Testing Checklist

**Location:** `MANUAL_TESTING_CHECKLIST.md`

**Key Scenarios:**

1. **Context Gathering:**
   - "budget $50" → Should ask for recipient/interests
   - "gift for mom" → Should ask for budget/interests
   - "gift for mom, budget $50" → Should show recommendations ✅

2. **Budget Badges:**
   - Enter "gift for mom, budget $50"
   - Verify green "✓ In Budget" on products ≤$50
   - Verify yellow "Near Budget" on products $50-$60

3. **Urgency Detection:**
   - Enter "need gift ASAP"
   - Verify yellow ⚡ banner appears
   - Verify blue 📦 "Fast Ship" badges on products

4. **Quality Filtering:**
   - Enter niche request: "gift for uncle who collects vintage stamps, $40"
   - Should show 2-3 products (not 5)
   - Message should say "I found a few options that might work"

---

### Metrics Dashboard (Future)

**Key Metrics to Track:**

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| Time to First Recommendation | ~3s | <2s | Performance metrics API |
| Refinement Rate | 82% | <40% | Track "show me other" requests |
| Satisfaction Rate | 30% | >70% | Post-recommendation survey |
| Context Signals at First Rec | 1.2 | 2.3+ | Log context at ready=true |
| Avg Recommendation Score | 0.58 | >0.70 | Log scores in recommendations |
| Premature Recommendations | ~40% | <10% | Track ready=false → ready=true |

---

## Quick Start Guide (For New Developers)

### 1. Setup (5 minutes)

```bash
# Clone repo
git clone [repo-url]
cd Present-Agent

# Install dependencies
npm install

# Copy env file
cp .env.example .env.local

# Start all services (Docker + API + Web)
npm run dev:five
```

Visit http://localhost:3000

---

### 2. Test Basic Flow (2 minutes)

Open browser, test these scenarios:

```
Scenario 1 (Insufficient Context):
User: "budget $50"
Expected: "Got the budget! Who's the gift for? What are they into?"

Scenario 2 (Sufficient Context):
User: "gift for mom who loves gardening, budget $50"
Expected: [Shows 3-5 products with green budget badges]

Scenario 3 (Urgency):
User: "need birthday gift ASAP"
Expected: Yellow ⚡ banner + 📦 Fast Ship badges
```

---

### 3. Understand the Flow (10 minutes)

Read this guide's [Section 3: Recommendation Workflow](#3-recommendation-workflow)

Key files to understand:
- `src/server/index.ts` lines 590-900 (context gathering)
- `src/server/services/recommend.ts` (scoring logic)
- `src/web/app/page.tsx` (UI)

---

### 4. Make Your First Change (15 minutes)

**Task:** Add a new context signal for "gift type" (physical vs digital)

1. **Extract signal** (`src/server/index.ts` around line 662):
```typescript
const giftType = /digital|virtual|online/.test(text) ? 'digital' : 'physical';
extractedData.giftType = giftType;
```

2. **Include in readiness** (around line 759):
```typescript
const hasGiftType = !!merged.giftType;
const contextSignals = [hasBudget, hasRecipient, hasInterests, hasOccasion, hasGiftType]
  .filter(Boolean).length;
```

3. **Use in search** (`src/server/index.ts` around line 900):
```typescript
if (merged.giftType === 'digital') {
  facetQuery.types = ['digital', 'virtual', 'e-gift'];
}
```

4. **Test:**
```
User: "digital gift for tech lover, $30"
Should filter to digital/e-gift products
```

---

## Troubleshooting

### Common Issues

**Issue:** No products showing up
- Check: Is PostgreSQL running? (`psql postgres://present:present@localhost:5432/present`)
- Check: Are products imported? (`SELECT COUNT(*) FROM products;`)
- Check: Context signals >= 2? (Check browser console for `ready` value)

**Issue:** Budget badges not showing
- Check: Is budget parsed correctly? (Browser DevTools → Network → /api/chat → response → check contextSummary)
- Check: ProductCard receiving budget props? (React DevTools)

**Issue:** Low recommendation scores
- Check: Are facets extracted? (`SELECT * FROM product_facets LIMIT 10;`)
- Check: Run facet extraction: `npm run extract:facets -- --limit 100`

---

## Further Reading

- **Product Vision:** `product_vision.md` - Background & goals
- **Agent Guidelines:** `AGENTS.md` - Development conventions
- **Personalization:** `PERSONALIZATION_RECOMMENDATIONS.md` - Advanced features
- **Facet System:** `FACETS.md` - Attribute extraction
- **UX Fixes:** `ALL_UX_FIXES_COMPLETE.md` - Recent improvements
- **Context Strategy:** `CONTEXT_IMPROVEMENTS.md` - Gathering requirements

---

## Changelog

**2025-10-07:**
- ✅ Implemented context signal requirement (minimum 2 signals)
- ✅ Added quality-based filtering (high/medium/low thresholds)
- ✅ Implemented all 5 UX fixes (P100-P65)
- ✅ Added quality-aware messaging
- ✅ Consolidated documentation

**Previous:**
- Implemented 11 personalization features (session tracking, trending, etc.)
- Created test framework (50-conversation simulator)
- LLM facet extraction system
- A/B testing framework (Thompson Sampling)

---

**End of Guide**

For questions, refer to code comments or reach out to the team.
