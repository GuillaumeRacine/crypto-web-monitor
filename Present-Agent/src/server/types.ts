// Shared domain and API types for 5-DB mode (Postgres, Neo4j, Vector DB, Redis, Event Store)

export type ID = string;

export interface User {
  id: ID;
  email?: string;
  name?: string;
  createdAt: string;
}

export interface Recipient {
  id: ID;
  name?: string;
  relationshipToUser?: string; // e.g., partner, friend, colleague
  preferences?: Record<string, unknown>;
  createdAt: string;
}

export interface Relationship {
  id: ID;
  userId: ID;
  recipientId: ID;
  strength?: number; // heuristic
}

export interface Occasion {
  id: ID;
  recipientId: ID;
  type: string; // birthday, anniversary, etc.
  date?: string;
  metadata?: Record<string, unknown>;
}

export interface Product {
  id: ID;
  sourceWebsite?: string;
  handle?: string;
  sku?: string | null;
  title: string;
  description?: string | null;
  vendor?: string | null;
  price: number;
  currency?: string;
  available: boolean;
  category?: string | null;
  imageUrl?: string | null;
  productUrl: string;
  tags?: string[];
  attributes?: Record<string, unknown>;
}

export interface Feedback {
  id: ID;
  userId: ID;
  recipientId?: ID;
  productId?: ID;
  rating: number; // -1, 0, 1 or 1..5
  comment?: string;
  createdAt: string;
}

export interface SearchQuery {
  text?: string;
  budgetMin?: number;
  budgetMax?: number;
  categories?: string[];
  interests?: string[];
  facets?: {
    occasion?: string;
    recipient?: string;
    recipients?: string[];  // NEW: support multiple recipient patterns
    interests?: string[];
    values?: string[];
  };
  limit?: number;
  offset?: number;
}

export interface RecommendationInput {
  userId?: ID;
  recipientId?: ID;
  occasion?: string;
  interests?: string[];
  query?: SearchQuery;
}

export interface RecommendedItem {
  product: Product;
  score: number;
  rationale?: string;
}

export interface RecommendationResult {
  items: RecommendedItem[];
  tookMs?: number;
  performanceMetrics?: {
    contextLoadMs: number;
    recommendationMs: number;
    totalMs: number;
  };
}

// Adapter interfaces
export interface CatalogStore {
  ingest(products: Product[]): Promise<number>; // returns count
  search(q: SearchQuery): Promise<Product[]>;
  getById(id: ID): Promise<Product | null>;
  listCategories(): Promise<string[]>;
}

export interface VectorIndex {
  upsertProducts(products: Product[]): Promise<void>;
  search(query: string, k: number, filters?: Record<string, unknown>): Promise<{ id: ID; score: number }[]>;
}

export interface GraphStore {
  upsertRelationshipGraph(payload: Record<string, unknown>): Promise<void>;
  getPreferredCategories(recipientId: ID): Promise<string[]>;
}

export interface RealtimeCache {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T, ttlSeconds?: number): Promise<void>;
}

export interface EventSink {
  publish(event: { type: string; payload: Record<string, unknown>; ts?: number }): Promise<void>;
}
