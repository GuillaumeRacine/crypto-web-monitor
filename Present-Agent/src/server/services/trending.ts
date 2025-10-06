/**
 * Trending Products Detection
 *
 * Detects products with sudden spikes in views/clicks compared to historical baseline.
 * Uses a simple ratio-based approach: recent activity / historical activity.
 */

import type { Pool } from 'pg';

export interface TrendingProduct {
  productId: string;
  recentCount: number;
  historicalCount: number;
  trendScore: number; // ratio of recent/historical activity
}

export interface TrendingOptions {
  recentDays?: number; // Default: 7 days
  historicalDays?: number; // Default: 30 days
  minActivity?: number; // Minimum recent views to be considered trending
  limit?: number; // Max number of trending products to return
}

/**
 * Get trending products based on event activity
 */
export async function getTrendingProducts(
  pool: Pool,
  options: TrendingOptions = {}
): Promise<TrendingProduct[]> {
  const {
    recentDays = 7,
    historicalDays = 30,
    minActivity = 10,
    limit = 20,
  } = options;

  try {
    const result = await pool.query<TrendingProduct>(`
      WITH recent_activity AS (
        SELECT
          (payload->>'product_id')::TEXT as product_id,
          COUNT(*) as recent_count
        FROM events
        WHERE type IN ('product_view', 'product_click')
          AND created_at > NOW() - INTERVAL '${recentDays} days'
          AND payload->>'product_id' IS NOT NULL
        GROUP BY product_id
      ),
      historical_activity AS (
        SELECT
          (payload->>'product_id')::TEXT as product_id,
          COUNT(*) as historical_count
        FROM events
        WHERE type IN ('product_view', 'product_click')
          AND created_at BETWEEN NOW() - INTERVAL '${historicalDays} days' AND NOW() - INTERVAL '${recentDays} days'
          AND payload->>'product_id' IS NOT NULL
        GROUP BY product_id
      )
      SELECT
        r.product_id as "productId",
        r.recent_count as "recentCount",
        COALESCE(h.historical_count, 0) as "historicalCount",
        CASE
          WHEN COALESCE(h.historical_count, 0) = 0 THEN r.recent_count::NUMERIC
          ELSE (r.recent_count::NUMERIC / h.historical_count::NUMERIC)
        END as "trendScore"
      FROM recent_activity r
      LEFT JOIN historical_activity h ON r.product_id = h.product_id
      WHERE r.recent_count >= $1
      ORDER BY "trendScore" DESC
      LIMIT $2
    `, [minActivity, limit]);

    return result.rows;
  } catch (error: any) {
    console.error('[trending] Failed to get trending products:', error.message);
    return [];
  }
}

/**
 * Check if a specific product is trending
 */
export async function isProductTrending(
  pool: Pool,
  productId: string,
  trendThreshold = 2.0 // Product must have 2x recent activity vs historical
): Promise<boolean> {
  try {
    const trending = await getTrendingProducts(pool, { limit: 100 });
    const product = trending.find((t) => t.productId === productId);

    return product ? product.trendScore >= trendThreshold : false;
  } catch (error) {
    return false;
  }
}

/**
 * Get trending product IDs (for boosting in recommendations)
 */
export async function getTrendingProductIds(
  pool: Pool,
  limit = 20
): Promise<string[]> {
  const trending = await getTrendingProducts(pool, { limit });
  return trending.map((t) => t.productId);
}

/**
 * Boost trending products in recommendation results
 */
export function applyTrendingBoost<T extends { product: { id: string }; score: number }>(
  items: T[],
  trendingIds: Set<string>,
  boostAmount = 0.2
): T[] {
  return items.map((item) => ({
    ...item,
    score: item.score + (trendingIds.has(item.product.id) ? boostAmount : 0),
  }));
}

/**
 * Cache for trending products (refresh every 5 minutes)
 */
class TrendingCache {
  private cache: Set<string> = new Set();
  private lastUpdate: number = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  async getTrendingIds(pool: Pool): Promise<Set<string>> {
    const now = Date.now();

    if (now - this.lastUpdate > this.CACHE_TTL_MS) {
      const ids = await getTrendingProductIds(pool, 50);
      this.cache = new Set(ids);
      this.lastUpdate = now;

      if (ids.length > 0) {
        console.log(`[trending] Cache refreshed: ${ids.length} trending products`);
      }
    }

    return this.cache;
  }

  clear(): void {
    this.cache.clear();
    this.lastUpdate = 0;
  }
}

export const trendingCache = new TrendingCache();
