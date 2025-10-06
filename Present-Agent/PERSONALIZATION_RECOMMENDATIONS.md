# Personalization Recommendations for Present-Agent

## Executive Summary

This document outlines advanced personalization techniques to make gift recommendations more contextual, relevant, and tailored to individual users. The system already has hybrid semantic search with Cohere reranking and a strong data foundation (feedback, events, user/recipient contexts). The recommendations below leverage existing infrastructure while introducing new capabilities.

---

## 1. User-Level Personalization

### 1.1 User Embeddings & Preference Learning
**Current State**: No persistent user preference model
**Recommendation**: Build user embedding vectors from interaction history

**Implementation**:
```typescript
// Generate user embedding from their interaction history
async function buildUserEmbedding(userId: string): Promise<number[]> {
  // Fetch user's positive interactions (clicks, purchases, high ratings)
  const interactions = await pool.query(`
    SELECT p.title, p.description, p.category, f.rating
    FROM feedback f
    JOIN products p ON f.product_id = p.id
    WHERE f.user_id = $1 AND f.rating >= 4
  `, [userId]);

  // Average embeddings of liked products (weighted by rating)
  const productEmbeddings = await Promise.all(
    interactions.rows.map(row =>
      embed.getEmbedding(`${row.title} ${row.description} ${row.category}`)
    )
  );

  // Weighted average based on ratings
  return weightedAverageEmbedding(productEmbeddings, interactions.rows.map(r => r.rating));
}

// Use in search: boost products similar to user's taste
const userVector = await buildUserEmbedding(userId);
const userSimilarityBoost = cosineSimilarity(productVector, userVector) * 0.3;
```

**Data Source**: `feedback` table (product_id, rating), `events` table (product_view, add_to_cart)

### 1.2 Collaborative Filtering
**Current State**: Recommendations are context-only (no "users like you" signals)
**Recommendation**: Find similar users and recommend products they liked

**Implementation**:
```typescript
// Find users with similar taste profiles
async function findSimilarUsers(userId: string, limit = 10): Promise<string[]> {
  // Users who liked the same products
  const similarUsers = await pool.query(`
    WITH user_likes AS (
      SELECT product_id FROM feedback
      WHERE user_id = $1 AND rating >= 4
    )
    SELECT f.user_id, COUNT(*) as overlap
    FROM feedback f
    WHERE f.product_id IN (SELECT product_id FROM user_likes)
      AND f.user_id != $1
      AND f.rating >= 4
    GROUP BY f.user_id
    ORDER BY overlap DESC
    LIMIT $2
  `, [userId, limit]);

  return similarUsers.rows.map(r => r.user_id);
}

// Recommend products liked by similar users
async function collaborativeRecommendations(userId: string): Promise<Product[]> {
  const similarUsers = await findSimilarUsers(userId);

  return pool.query(`
    SELECT p.*, AVG(f.rating) as avg_rating
    FROM products p
    JOIN feedback f ON p.id = f.product_id
    WHERE f.user_id = ANY($1)
      AND f.rating >= 4
      AND p.id NOT IN (
        SELECT product_id FROM feedback WHERE user_id = $2
      )
    GROUP BY p.id
    ORDER BY avg_rating DESC, COUNT(*) DESC
    LIMIT 20
  `, [similarUsers, userId]);
}
```

**Data Source**: `feedback` table (cross-user rating patterns)

### 1.3 Purchase History Analysis
**Current State**: No purchase history tracking
**Recommendation**: Track purchases and learn category/price preferences

**Schema Addition**:
```sql
CREATE TABLE purchases (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  recipient_key TEXT,
  occasion TEXT,
  purchased_at TIMESTAMP DEFAULT NOW()
);
```

**Usage**:
```typescript
// Learn user's spending patterns per occasion
async function getBudgetPreference(userId: string, occasion?: string): Promise<{min: number, max: number}> {
  const purchases = await pool.query(`
    SELECT AVG(p.price) as avg_price, STDDEV(p.price) as stddev
    FROM purchases pu
    JOIN products p ON pu.product_id = p.id
    WHERE pu.user_id = $1
      ${occasion ? 'AND pu.occasion = $2' : ''}
  `, occasion ? [userId, occasion] : [userId]);

  const avg = purchases.rows[0].avg_price || 50;
  const std = purchases.rows[0].stddev || 20;

  return { min: avg - std, max: avg + std };
}
```

---

## 2. Context-Aware Recommendations

### 2.1 Recipient Relationship Modeling
**Current State**: Basic recipient_key extraction (friend, mom, dad, etc.)
**Recommendation**: Build rich recipient profiles with gift history

**Implementation**:
```typescript
// Track what works for this user->recipient relationship
async function getRecipientProfile(userId: string, recipientKey: string) {
  const history = await pool.query(`
    SELECT p.category, p.price, f.rating, pf.facet_key, pf.facet_value
    FROM feedback f
    JOIN products p ON f.product_id = p.id
    LEFT JOIN product_facets pf ON p.id = pf.product_id
    WHERE f.user_id = $1 AND f.recipient_id = $2
    ORDER BY f.created_at DESC
  `, [userId, recipientKey]);

  // Learn: What categories work? What price range? What values matter?
  const categoryPrefs = aggregateByCategory(history.rows);
  const priceRange = calculatePriceRange(history.rows);
  const valuePrefs = extractValuePreferences(history.rows);

  return { categoryPrefs, priceRange, valuePrefs };
}

// Use recipient profile to boost relevant products
const profile = await getRecipientProfile(userId, recipientKey);
if (profile.categoryPrefs[product.category] > 0.7) {
  score += 0.4; // Strong category match for this recipient
}
```

**Data Source**: `recipient_context` table (existing), `feedback` table

### 2.2 Occasion Pattern Learning
**Current State**: Occasion extraction exists but no learning
**Recommendation**: Learn seasonal and occasion-specific preferences

**Implementation**:
```typescript
// Detect occasion from timestamp + conversation
async function inferOccasion(text: string, timestamp: Date): Promise<string | undefined> {
  const month = timestamp.getMonth();
  const day = timestamp.getDate();

  // Seasonal patterns
  if (month === 11) return 'christmas';
  if (month === 1 && day <= 14) return 'valentine';
  if (month === 4 && day <= 15) return 'mothers_day';

  // NLP extraction (existing)
  const extracted = extractOccasion(text);
  return extracted;
}

// Boost products that worked for this occasion historically
async function getOccasionBestSellers(occasion: string, limit = 20): Promise<Product[]> {
  return pool.query(`
    SELECT p.*, COUNT(*) as purchase_count, AVG(f.rating) as avg_rating
    FROM products p
    JOIN purchases pu ON p.id = pu.product_id
    LEFT JOIN feedback f ON p.id = f.product_id AND pu.user_id = f.user_id
    WHERE pu.occasion = $1
    GROUP BY p.id
    ORDER BY purchase_count DESC, avg_rating DESC
    LIMIT $2
  `, [occasion, limit]);
}
```

### 2.3 Temporal & Urgency Signals
**Current State**: Emotional state extraction includes urgency
**Recommendation**: Adjust recommendations based on urgency

**Implementation**:
```typescript
// If urgent, prioritize fast shipping / digital gifts / gift cards
if (emotionalState.urgency) {
  items = items.map(item => {
    let urgencyBoost = 0;

    // Check shipping speed (requires product_facets addition)
    const shippingFacet = item.facets?.find(f => f.key === 'shipping_speed');
    if (shippingFacet?.value === 'same_day') urgencyBoost += 0.5;
    else if (shippingFacet?.value === 'next_day') urgencyBoost += 0.3;

    // Digital products (no shipping)
    if (item.product.category?.includes('Digital')) urgencyBoost += 0.4;

    // Gift cards (instant delivery)
    if (item.product.category?.includes('Gift Card')) urgencyBoost += 0.6;

    return { ...item, score: item.score + urgencyBoost };
  }).sort((a, b) => b.score - a.score);
}
```

---

## 3. Product Intelligence

### 3.1 Automatic Facet Extraction with LLMs
**Current State**: Facets are manually assigned
**Recommendation**: Use LLM (Claude/GPT) to auto-extract facets from product data

**Implementation**:
```typescript
// scripts/auto-facet-extraction.ts
async function extractFacetsWithLLM(product: Product): Promise<Array<{key: string, value: string, confidence: number}>> {
  const prompt = `Analyze this product and extract gift-relevant facets:

Title: ${product.title}
Description: ${product.description}
Category: ${product.category}

Extract the following facets (only if clearly applicable):
1. recipient: (who is this for? e.g., him, her, kids, friend, mom, dad, colleague)
2. occasion: (what occasions? e.g., birthday, wedding, anniversary, christmas)
3. interest: (what hobbies/interests? e.g., cooking, gaming, gardening, art)
4. value: (product values? e.g., sustainable, handmade, luxury, personalized)
5. theme: (aesthetic themes? e.g., minimalist, quirky, elegant, rustic)

Return JSON only:
{
  "facets": [
    {"key": "recipient", "value": "him", "confidence": 0.9},
    {"key": "interest", "value": "fishing", "confidence": 0.95}
  ]
}`;

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }]
  });

  const parsed = JSON.parse(response.content[0].text);
  return parsed.facets;
}

// Batch process all products
for (const product of products) {
  const facets = await extractFacetsWithLLM(product);

  // Upsert facets
  for (const facet of facets) {
    await pool.query(`
      INSERT INTO product_facets (product_id, facet_key, facet_value, confidence)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (product_id, facet_key, facet_value)
      DO UPDATE SET confidence = EXCLUDED.confidence
    `, [product.id, facet.key, facet.value, facet.confidence]);
  }
}
```

**Benefits**:
- Scales to thousands of products automatically
- Finds nuanced connections (e.g., "lure making kit" → interest:fishing)
- Confidence scores for facet reliability

### 3.2 Product Embeddings with Multi-Modal Context
**Current State**: Embeddings from title + description only
**Recommendation**: Include reviews, tags, category hierarchy

**Implementation**:
```typescript
// Enhanced embedding text construction
function buildProductEmbeddingText(product: Product, facets: Facet[], reviews?: string[]): string {
  const parts = [
    product.title,
    product.description || '',
    product.category || '',
    product.vendor || '',

    // Add facets as context
    facets.map(f => `${f.key}:${f.value}`).join(' '),

    // Add review sentiment (optional)
    reviews?.join(' ') || ''
  ];

  return parts.filter(Boolean).join(' | ');
}

// Re-index with richer context
const facets = await getFacets(product.id);
const reviews = await getTopReviews(product.id, 5); // Top 5 helpful reviews
const embeddingText = buildProductEmbeddingText(product, facets, reviews);
const embedding = await embed.getEmbedding(embeddingText);
```

### 3.3 Trend Detection & Seasonal Boosting
**Current State**: No trend awareness
**Recommendation**: Detect trending products and seasonal relevance

**Implementation**:
```typescript
// Detect trending products (sudden spike in views/purchases)
async function getTrendingProducts(days = 7, limit = 20): Promise<Product[]> {
  return pool.query(`
    WITH recent_activity AS (
      SELECT
        (payload->>'product_id')::TEXT as product_id,
        COUNT(*) as recent_count
      FROM events
      WHERE type IN ('product_view', 'add_to_cart')
        AND created_at > NOW() - INTERVAL '${days} days'
      GROUP BY product_id
    ),
    historical_activity AS (
      SELECT
        (payload->>'product_id')::TEXT as product_id,
        COUNT(*) as historical_count
      FROM events
      WHERE type IN ('product_view', 'add_to_cart')
        AND created_at BETWEEN NOW() - INTERVAL '30 days' AND NOW() - INTERVAL '${days} days'
      GROUP BY product_id
    )
    SELECT p.*,
      r.recent_count,
      COALESCE(h.historical_count, 0) as historical_count,
      (r.recent_count::FLOAT / NULLIF(h.historical_count, 0)) as trend_score
    FROM products p
    JOIN recent_activity r ON p.id = r.product_id
    LEFT JOIN historical_activity h ON p.id = h.product_id
    WHERE r.recent_count > 10
    ORDER BY trend_score DESC
    LIMIT $1
  `, [limit]);
}

// Boost trending products in recommendations
const trending = await getTrendingProducts();
const trendingIds = new Set(trending.map(p => p.id));
items = items.map(item => ({
  ...item,
  score: item.score + (trendingIds.has(item.product.id) ? 0.2 : 0)
}));
```

---

## 4. Behavioral Signals

### 4.1 Click & Dwell Time Tracking
**Current State**: No interaction tracking beyond feedback
**Recommendation**: Track all user interactions for implicit feedback

**Schema Addition**:
```sql
-- events table already exists, ensure it captures:
INSERT INTO events (type, payload) VALUES
  ('product_view', '{"product_id": "123", "dwell_time_ms": 5000, "user_id": "user123"}'),
  ('product_click', '{"product_id": "123", "position": 1, "query": "fishing gifts"}'),
  ('search', '{"query": "fishing gifts", "results_count": 15, "user_id": "user123"}');
```

**Implementation**:
```typescript
// Implicit feedback scoring
async function getImplicitPreferenceScore(userId: string, productId: string): Promise<number> {
  const interactions = await pool.query(`
    SELECT type, payload FROM events
    WHERE (payload->>'user_id')::TEXT = $1
      AND (payload->>'product_id')::TEXT = $2
    ORDER BY created_at DESC
  `, [userId, productId]);

  let score = 0;
  for (const event of interactions.rows) {
    if (event.type === 'product_view') {
      const dwellTime = event.payload.dwell_time_ms || 0;
      score += Math.min(dwellTime / 1000, 10) * 0.1; // Max 1.0 for 10+ seconds
    }
    if (event.type === 'product_click') score += 0.3;
    if (event.type === 'add_to_cart') score += 0.5;
  }

  return Math.min(score, 2.0); // Cap at 2.0
}

// Boost products user has shown interest in
for (const item of items) {
  const implicitScore = await getImplicitPreferenceScore(userId, item.product.id);
  item.score += implicitScore;
}
```

### 4.2 Conversation Analysis
**Current State**: Conversations stored but not analyzed
**Recommendation**: Extract insights from conversation history

**Implementation**:
```typescript
// Analyze user's conversation patterns
async function analyzeConversationStyle(userId: string): Promise<{
  avgBudget: number,
  commonRecipients: string[],
  preferredCategories: string[],
  sentimentTrend: 'positive' | 'neutral' | 'negative'
}> {
  const conversations = await pool.query(`
    SELECT m.content, c.metadata
    FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    WHERE c.user_id = $1
    ORDER BY m.created_at DESC
    LIMIT 100
  `, [userId]);

  // Extract patterns using LLM
  const analysisPrompt = `Analyze these gift-shopping conversations and extract:
1. Average budget mentioned
2. Most common recipients
3. Preferred gift categories
4. Overall sentiment (positive/neutral/negative)

Conversations:
${conversations.rows.map(r => r.content).join('\n---\n')}

Return JSON only.`;

  // Use Claude to analyze
  const analysis = await callLLMForAnalysis(analysisPrompt);
  return analysis;
}
```

### 4.3 A/B Testing & Multi-Armed Bandits
**Current State**: Static ranking algorithm
**Recommendation**: Dynamic algorithm optimization

**Implementation**:
```typescript
// Thompson Sampling for ranking algorithm selection
interface RankingAlgorithm {
  name: string;
  successes: number;
  failures: number;
}

async function selectRankingAlgorithm(userId: string): Promise<string> {
  const algorithms = await pool.query(`
    SELECT name, successes, failures FROM ranking_algorithms
  `);

  // Thompson Sampling: sample from beta distribution
  const samples = algorithms.rows.map(alg => ({
    name: alg.name,
    sample: betaSample(alg.successes + 1, alg.failures + 1)
  }));

  // Select algorithm with highest sample
  const selected = samples.reduce((best, curr) =>
    curr.sample > best.sample ? curr : best
  );

  return selected.name;
}

// Update based on user feedback
async function recordRankingFeedback(algorithm: string, success: boolean) {
  await pool.query(`
    UPDATE ranking_algorithms
    SET ${success ? 'successes' : 'failures'} = ${success ? 'successes' : 'failures'} + 1
    WHERE name = $1
  `, [algorithm]);
}
```

---

## 5. Advanced Techniques

### 5.1 Graph Neural Networks for Product Relationships
**Current State**: Neo4j graph database exists but underutilized
**Recommendation**: Build product-product and user-product-occasion graphs

**Implementation**:
```cypher
// Create rich graph relationships
MATCH (u:User {id: $userId})
MATCH (p:Product {id: $productId})
CREATE (u)-[:PURCHASED {occasion: $occasion, rating: $rating, timestamp: $timestamp}]->(p)

// Find products frequently bought together for same occasion
MATCH (p1:Product)<-[:PURCHASED {occasion: $occasion}]-(u:User)-[:PURCHASED {occasion: $occasion}]->(p2:Product)
WHERE p1.id = $seedProductId AND p1.id <> p2.id
RETURN p2, COUNT(*) as frequency
ORDER BY frequency DESC
LIMIT 10

// Collaborative filtering in graph
MATCH (u1:User {id: $userId})-[:PURCHASED]->(p:Product)<-[:PURCHASED]-(u2:User)
MATCH (u2)-[:PURCHASED]->(rec:Product)
WHERE NOT (u1)-[:PURCHASED]->(rec)
RETURN rec, COUNT(*) as score
ORDER BY score DESC
```

**Benefits**:
- Find "frequently bought together" patterns
- Discover substitutable products
- Occasion-aware recommendations

### 5.2 Reinforcement Learning for Session Optimization
**Current State**: No sequential decision making
**Recommendation**: RL agent learns optimal product sequence to show

**Conceptual Implementation**:
```typescript
// State: user context + current session + products shown
interface SessionState {
  userId: string;
  recipientKey?: string;
  occasion?: string;
  budgetMax?: number;
  productsShown: string[];
  interactions: Array<{productId: string, clicked: boolean, dwellTime: number}>;
}

// Action: which product to show next
// Reward: +1 for click, +5 for add-to-cart, +10 for purchase, -0.1 for each product shown (to encourage efficiency)

// Use DQN (Deep Q-Network) or PPO (Proximal Policy Optimization)
// This requires significant ML infrastructure but can optimize engagement
```

### 5.3 Diversity & Serendipity Balancing
**Current State**: Pure relevance ranking (may create filter bubble)
**Recommendation**: Introduce controlled diversity

**Implementation**:
```typescript
// Maximal Marginal Relevance (MMR) for diversity
function diversifyResults(
  items: Array<{product: Product, score: number}>,
  lambda = 0.7 // 0.7 = 70% relevance, 30% diversity
): Array<{product: Product, score: number}> {
  const selected: typeof items = [];
  const remaining = [...items];

  // Always select top item
  selected.push(remaining.shift()!);

  while (remaining.length > 0 && selected.length < 15) {
    // Score each remaining item by: relevance - similarity to already selected
    const scores = remaining.map(item => {
      const relevance = item.score;

      // Max similarity to any selected item
      const maxSimilarity = Math.max(...selected.map(sel =>
        categorySimilarity(item.product.category, sel.product.category)
      ));

      // MMR formula
      const mmrScore = lambda * relevance - (1 - lambda) * maxSimilarity;
      return { item, mmrScore };
    });

    // Select item with highest MMR score
    scores.sort((a, b) => b.mmrScore - a.mmrScore);
    const best = scores[0];
    selected.push(best.item);
    remaining.splice(remaining.indexOf(best.item), 1);
  }

  return selected;
}

// Category similarity helper
function categorySimilarity(cat1: string, cat2: string): number {
  if (cat1 === cat2) return 1.0;
  // Use category hierarchy or embeddings for partial similarity
  const cat1Embed = categoryEmbeddings[cat1];
  const cat2Embed = categoryEmbeddings[cat2];
  return cosineSimilarity(cat1Embed, cat2Embed);
}
```

---

## 6. Real-Time Personalization

### 6.1 Session-Based Recommendations
**Current State**: Stateless recommendations
**Recommendation**: Track session context and adapt in real-time

**Implementation**:
```typescript
// Session state management
interface Session {
  id: string;
  userId?: string;
  startedAt: Date;
  currentQuery?: string;
  viewedProducts: string[];
  clickedProducts: string[];
  abandonedProducts: string[]; // Viewed but not clicked
  inferredIntent?: {
    recipientKey?: string;
    occasion?: string;
    priceRange?: {min: number, max: number};
    categories?: string[];
  };
}

// Update session with each interaction
async function updateSession(sessionId: string, interaction: {
  type: 'view' | 'click' | 'search',
  productId?: string,
  query?: string
}) {
  const session = await getSession(sessionId);

  if (interaction.type === 'view') {
    session.viewedProducts.push(interaction.productId!);
  }

  if (interaction.type === 'click') {
    session.clickedProducts.push(interaction.productId!);

    // Learn from what they click
    const product = await catalog.getById(interaction.productId!);
    if (product) {
      if (!session.inferredIntent) session.inferredIntent = {};

      // Infer category preference
      if (!session.inferredIntent.categories) session.inferredIntent.categories = [];
      session.inferredIntent.categories.push(product.category);

      // Infer price range
      if (!session.inferredIntent.priceRange) {
        session.inferredIntent.priceRange = {min: product.price * 0.8, max: product.price * 1.2};
      }
    }
  }

  // Track abandonment (viewed but not clicked after 3+ views)
  const viewedNotClicked = session.viewedProducts.filter(id =>
    !session.clickedProducts.includes(id)
  );
  if (viewedNotClicked.length >= 3) {
    session.abandonedProducts = viewedNotClicked.slice(-3);
  }

  await saveSession(session);
}

// Use session context in recommendations
async function sessionAwareRecommend(sessionId: string, query: string): Promise<Product[]> {
  const session = await getSession(sessionId);

  // Boost categories user has clicked
  const categoryBoost = session.inferredIntent?.categories || [];

  // Avoid showing abandoned products again
  const excludeIds = session.abandonedProducts;

  // Use inferred price range
  const priceRange = session.inferredIntent?.priceRange;

  return recommend({
    query: { text: query, budgetMin: priceRange?.min, budgetMax: priceRange?.max },
    categoryBoost,
    excludeIds
  });
}
```

### 6.2 Streaming Updates with Redis
**Current State**: Batch processing only
**Recommendation**: Real-time recommendation updates

**Implementation**:
```typescript
// Publish user interaction events to Redis stream
await redis.xadd(
  'user:interactions',
  '*',
  'userId', userId,
  'type', 'product_click',
  'productId', productId,
  'timestamp', Date.now()
);

// Consumer: Update user embeddings in real-time
const consumer = async () => {
  while (true) {
    const events = await redis.xread('BLOCK', 1000, 'STREAMS', 'user:interactions', lastId);

    for (const event of events) {
      const {userId, type, productId} = event.data;

      if (type === 'product_click' || type === 'purchase') {
        // Incrementally update user embedding
        await updateUserEmbeddingIncremental(userId, productId);
      }
    }
  }
};

// Incremental embedding update (moving average)
async function updateUserEmbeddingIncremental(userId: string, productId: string) {
  const currentEmbedding = await redis.get(`user:${userId}:embedding`);
  const productEmbedding = await getProductEmbedding(productId);

  // Moving average: 90% old, 10% new
  const updated = currentEmbedding.map((val, i) =>
    val * 0.9 + productEmbedding[i] * 0.1
  );

  await redis.set(`user:${userId}:embedding`, JSON.stringify(updated));
}
```

---

## 7. Leveraging Existing Data

### 7.1 Feedback Table Optimization
**Current table**: `feedback (user_id, recipient_id, product_id, rating, comment)`

**Enhancements**:
```sql
-- Add implicit signals
ALTER TABLE feedback ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE feedback ADD COLUMN interaction_count INTEGER DEFAULT 1; -- How many times viewed before rating
ALTER TABLE feedback ADD COLUMN time_to_decision_ms BIGINT; -- Time between first view and rating

-- Index for collaborative filtering
CREATE INDEX idx_feedback_rating ON feedback(rating) WHERE rating >= 4;
CREATE INDEX idx_feedback_user_product ON feedback(user_id, product_id);
```

**Usage**:
- High `interaction_count` + high rating = strong preference
- Low `time_to_decision_ms` = obvious fit (use for fast recommendations)
- Negative ratings = learn what NOT to recommend

### 7.2 Events Table Enrichment
**Current table**: `events (type, payload, created_at)`

**Best Practices**:
```typescript
// Capture rich events
await logEvent({
  type: 'recommendation_shown',
  payload: {
    sessionId,
    userId,
    query: 'fishing gifts',
    products: items.map(i => i.product.id),
    algorithm: 'hybrid_semantic_v2',
    context: { recipientKey: 'friend', budgetMax: 100 }
  }
});

await logEvent({
  type: 'product_purchased',
  payload: {
    userId,
    productId,
    position: 2, // Was 2nd in recommendations
    query: 'fishing gifts',
    sessionId,
    priceAtPurchase: 99.99,
    recommendationAlgorithm: 'hybrid_semantic_v2'
  }
});

// Analytics: Which algorithm converts best?
SELECT
  (payload->>'recommendationAlgorithm') as algorithm,
  COUNT(*) FILTER (WHERE type = 'recommendation_shown') as shown,
  COUNT(*) FILTER (WHERE type = 'product_purchased') as purchased,
  (COUNT(*) FILTER (WHERE type = 'product_purchased')::FLOAT /
   NULLIF(COUNT(*) FILTER (WHERE type = 'recommendation_shown'), 0)) as conversion_rate
FROM events
GROUP BY algorithm
ORDER BY conversion_rate DESC;
```

### 7.3 User/Recipient Context Tables
**Current tables**: `user_context`, `recipient_context` (jsonb data field)

**Structured Usage**:
```typescript
// Store learned preferences
await pool.query(`
  INSERT INTO user_context (user_id, data)
  VALUES ($1, $2)
  ON CONFLICT (user_id) DO UPDATE SET data = user_context.data || EXCLUDED.data
`, [userId, {
  preferredCategories: ['Sports & Outdoors', 'Art & Crafts'],
  avgBudget: 75,
  commonRecipients: ['friend', 'brother'],
  lastActive: new Date(),
  lifetimeValue: 450, // Total $ spent
  conversionRate: 0.23 // 23% of sessions → purchase
}]);

// Store recipient-specific learnings
await pool.query(`
  INSERT INTO recipient_context (user_id, recipient_key, data)
  VALUES ($1, $2, $3)
  ON CONFLICT (user_id, recipient_key) DO UPDATE SET data = recipient_context.data || EXCLUDED.data
`, [userId, 'friend', {
  successfulGifts: ['8739924738283', '7891234567890'], // Product IDs
  preferredPriceRange: {min: 50, max: 150},
  interests: ['fishing', 'camping', 'outdoors'],
  avoidCategories: ['Fashion', 'Beauty'], // Past failures
  lastGiftDate: '2024-12-15',
  relationshipStrength: 0.85 // 0-1 score
}]);
```

---

## 8. Implementation Priority

### Phase 1 (Immediate - 1-2 weeks)
1. **Auto-facet extraction with LLM** - Dramatically improves facet coverage
2. **Session-based recommendations** - Track and adapt within session
3. **Implicit feedback tracking** - Capture clicks, dwell time, abandonment

### Phase 2 (Short-term - 1 month)
4. **User embeddings** - Build preference vectors from history
5. **Recipient profile modeling** - Learn what works per relationship
6. **Trending & seasonal boosting** - Time-aware recommendations

### Phase 3 (Medium-term - 2-3 months)
7. **Collaborative filtering** - "Users like you also liked"
8. **Graph-based recommendations** - Leverage Neo4j for complex relationships
9. **Diversity optimization (MMR)** - Avoid filter bubbles

### Phase 4 (Long-term - 3-6 months)
10. **Reinforcement learning** - Optimize session flow
11. **Multi-armed bandits** - Dynamic algorithm selection
12. **Real-time streaming updates** - Redis-based live personalization

---

## 9. Success Metrics

Track these KPIs to measure personalization impact:

1. **Relevance Metrics**:
   - Click-through rate (CTR) on recommendations
   - Position of clicked items (lower = better)
   - Time to first click

2. **Engagement Metrics**:
   - Session duration
   - Products viewed per session
   - Return visit rate

3. **Business Metrics**:
   - Conversion rate (session → purchase)
   - Average order value
   - Customer lifetime value

4. **Quality Metrics**:
   - Product rating for recommended items
   - Diversity score (category spread in results)
   - Serendipity score (unexpected but loved items)

---

## 10. Quick Wins

Start here for immediate impact with minimal effort:

### Quick Win 1: LLM-Powered Facet Extraction
**Effort**: 4 hours | **Impact**: High
Run the Lure Making Kit through Claude to extract facets, then batch process top 100 products.

### Quick Win 2: Session Context Tracking
**Effort**: 6 hours | **Impact**: Medium-High
Add session tracking to capture clicked categories and inferred price range.

### Quick Win 3: Trending Products Badge
**Effort**: 3 hours | **Impact**: Medium
Query events table for spike detection, add "Trending" badge to UI.

### Quick Win 4: Occasion-Aware Defaults
**Effort**: 2 hours | **Impact**: Medium
Detect date-based occasions (Christmas, Valentine's) and auto-boost relevant products.

---

## Conclusion

The Present-Agent system has a strong foundation with hybrid semantic search and facet-based ranking. The recommendations above build on this foundation to create a deeply personalized, context-aware gift recommendation engine.

**Key Takeaways**:
1. **Leverage existing data**: feedback, events, context tables are goldmines
2. **LLM-powered intelligence**: Use Claude/GPT for facet extraction and insight generation
3. **Multi-signal approach**: Combine explicit (ratings) + implicit (clicks, dwell) + contextual (occasion, recipient) signals
4. **Start simple, scale up**: Quick wins first, then advanced ML techniques

The combination of semantic search, personalization, and contextual awareness will create a truly magical gift discovery experience.
