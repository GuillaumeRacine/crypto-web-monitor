import { CatalogService } from "./catalog.js";
import { EmbeddingsProvider } from "./embeddings.js";
import { RecommendationInput, RecommendationResult, VectorIndex, GraphStore } from "../types.js";
import { RerankService } from "./reranker.js";
import { trendingCache, applyTrendingBoost } from "./trending.js";
import { getCurrentOccasion, getOccasionBoost } from "./occasion-detector.js";
import type { Pool } from 'pg';

export class RecommendService {
  private reranker?: RerankService;
  private pool?: Pool;

  constructor(
    private catalog: CatalogService,
    private embed: EmbeddingsProvider,
    private vectorIndex?: VectorIndex,
    private graph?: GraphStore,
    cohereApiKey?: string,
    pool?: Pool,
  ) {
    if (cohereApiKey) {
      this.reranker = new RerankService(cohereApiKey);
      if (process.env.LOG_LEVEL === 'debug') {
        console.debug('[recommend] Cohere reranking enabled');
      }
    }
    this.pool = pool;
  }

  async recommend(input: RecommendationInput): Promise<RecommendationResult> {
    const start = Date.now();

    if (process.env.LOG_LEVEL === 'debug') {
      console.debug('[recommend] input', JSON.stringify(input, null, 2));
    }

    const qText = input.query?.text ?? "";
    const limit = input.query?.limit ?? 5;
    let items;

    // HYBRID APPROACH: Try semantic search first, then fallback to keyword
    if (this.vectorIndex && qText) {
      try {
        // Use vector search with ONLY budget filters (no rigid categories)
        // Semantic search will find relevant products across all categories
        const vectorLimit = Math.min(limit * 3, 30); // Get more candidates for reranking
        const hits = await this.vectorIndex.search(qText, vectorLimit, {
          budgetMin: input.query?.budgetMin,
          budgetMax: input.query?.budgetMax,
          // NO category filter - let semantic search find matches everywhere
        });

        if (process.env.LOG_LEVEL === 'debug') {
          console.debug(`[recommend] vector search returned ${hits.length} results`);
        }

        const resolved = await Promise.all(
          hits.map(async (h) => ({ product: await this.catalog.getById(h.id), score: h.score }))
        );
        items = resolved
          .filter((r): r is { product: NonNullable<typeof r.product>; score: number } => !!r.product)
          .map((r) => ({
            product: r.product,
            score: r.score,
            rationale: `Semantic match for ${input.occasion ?? "your occasion"}.`,
          }));

        if (process.env.LOG_LEVEL === 'debug') {
          console.debug(`[recommend] resolved ${items.length} products from vector search`);
        }
      } catch (e: any) {
        console.warn('[recommend] vector search failed, falling back to keyword:', e?.message || e);
      }
    }

    // Fallback: keyword search with facet filters (only if vector search failed)
    if (!items || items.length === 0) {
      const products = await this.catalog.search({
        text: qText,
        budgetMin: input.query?.budgetMin,
        budgetMax: input.query?.budgetMax,
        categories: input.query?.categories,
        interests: input.query?.interests,
        facets: input.query?.facets,
        limit: Math.min(limit * 2, 20),
      });
      items = products.map((p, i) => ({ product: p, score: 0.5 - i * 0.02 })); // Lower base score for keyword fallback
    }

    // If still empty (e.g., nonsense query), show a sensible default set
    if (items.length === 0) {
      const defaults = await this.catalog.search({
        limit,
        // intentionally omit text to return recent/popular items per adapter
      });
      items = defaults.map((p, i) => ({ product: p, score: 1 - i * 0.05 }));
    }

    // Facet-aware scoring boost
    if (items.length > 0) {
      // Fetch facets for all products in parallel
      const { default: pg } = await import('pg');
      const pool = (this.catalog as any).pool;
      if (pool) {
        try {
          const productIds = items.map(it => it.product.id);
          const facetRes = await pool.query(
            `SELECT product_id, facet_key, facet_value, confidence
             FROM product_facets
             WHERE product_id = ANY($1)`,
            [productIds]
          );

          const facetsByProduct: Record<string, Array<{key: string; value: string; confidence: number}>> = {};
          facetRes.rows.forEach((row: any) => {
            if (!facetsByProduct[row.product_id]) facetsByProduct[row.product_id] = [];
            facetsByProduct[row.product_id].push({
              key: row.facet_key,
              value: row.facet_value,
              confidence: parseFloat(row.confidence) || 1.0
            });
          });

          // Apply facet scoring boosts
          items = items.map((it) => {
            let score = it.score;
            const facets = facetsByProduct[it.product.id] || [];

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

            // Store facets for rationale building
            return { ...it, score, facets };
          });

          // Re-sort by new scores
          items.sort((a, b) => b.score - a.score);
        } catch (e) {
          console.warn('[recommend] facet scoring failed:', e);
        }
      }
    }

    // Graph-aware boost: if recipient has preferred categories, boost matching items
    if (this.graph && input.recipientId && items.length > 0) {
      try {
        const prefs = await this.graph.getPreferredCategories(input.recipientId);
        if (prefs?.length) {
          const prefSet = new Set(prefs.map((c) => c.toLowerCase()));
          items = items
            .map((it) => {
              const cat = (it.product.category || "").toLowerCase();
              const boost = prefSet.has(cat) ? 0.3 : 0;
              return { ...it, score: it.score + boost };
            })
            .sort((a, b) => b.score - a.score);
        }
      } catch (_) {
        // ignore graph errors for now
      }
    }

    // Trending boost: boost products with recent activity spikes
    if (this.pool && items.length > 0) {
      try {
        const trendingIds = await trendingCache.getTrendingIds(this.pool);
        items = applyTrendingBoost(items, trendingIds, 0.2);
        items.sort((a, b) => b.score - a.score);
      } catch (error) {
        // Ignore trending errors
      }
    }

    // Occasion boost: boost products matching current/upcoming occasions
    if (items.length > 0) {
      try {
        const currentOccasion = getCurrentOccasion();
        if (currentOccasion) {
          items = items.map((it: any) => {
            const facets = it.facets || [];
            const occasionFacets = facets.filter((f: any) => f.key === 'occasion');

            let boost = 0;
            for (const facet of occasionFacets) {
              boost += getOccasionBoost(facet.value, currentOccasion);
            }

            return { ...it, score: it.score + boost };
          });
          items.sort((a, b) => b.score - a.score);

          if (process.env.LOG_LEVEL === 'debug' && currentOccasion) {
            console.debug(`[recommend] Applied occasion boost for ${currentOccasion.occasion} (${currentOccasion.daysUntil} days)`);
          }
        }
      } catch (error) {
        // Ignore occasion errors
      }
    }

    // RERANKING: Apply Cohere reranking for final quality boost (if enabled)
    if (this.reranker && this.reranker.isEnabled() && qText && items.length > 0) {
      try {
        items = await this.reranker.rerank(qText, items, limit);
      } catch (error: any) {
        console.warn('[recommend] reranking failed:', error.message);
        // Continue with original ranking
      }
    }

    // Build facet-aware rationales
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
        const recipientFacets = facets.filter((f: any) => f.key === 'recipient');
        const match = recipientFacets.find((f: any) => f.value.includes(input.query!.facets!.recipient!));
        if (match) {
          parts.push(`Great gift ${match.value.replace(/_/g, ' ')}`);
        }
      }

      // Check interest matches
      if (input.interests && input.interests.length > 0) {
        const interestFacets = facets.filter((f: any) => f.key === 'interest' && input.interests!.includes(f.value));
        if (interestFacets.length > 0) {
          const interestNames = interestFacets.map((f: any) => f.value).join(' & ');
          parts.push(`Ideal for ${interestNames} enthusiasts`);
        }
      }

      // Check value matches
      if (input.query?.facets?.values && input.query.facets.values.length > 0) {
        const valueFacets = facets.filter((f: any) => f.key === 'value' && input.query!.facets!.values!.includes(f.value));
        if (valueFacets.length > 0) {
          const valueNames = valueFacets.map((f: any) => f.value.replace(/_/g, ' ')).join(' & ');
          parts.push(`${valueNames} choice`);
        }
      }

      // Budget check
      const within = (typeof input.query?.budgetMin !== 'number' || it.product.price >= input.query.budgetMin)
        && (typeof input.query?.budgetMax !== 'number' || it.product.price <= input.query.budgetMax);
      if (within && (input.query?.budgetMin != null || input.query?.budgetMax != null)) {
        const budgetStr = input.query.budgetMax ? `$${input.query.budgetMax}` : 'budget';
        parts.push(`Within your ${budgetStr} budget`);
      }

      // Fallback
      if (parts.length === 0) {
        const catHint = (input.query?.categories && input.query.categories.length) ? input.query.categories[0] : undefined;
        if (catHint && it.product.category && it.product.category.toLowerCase().includes(catHint.toLowerCase())) {
          parts.push(`Matches ${catHint}`);
        } else {
          parts.push('A thoughtful choice based on your preferences');
        }
      }

      return { ...it, rationale: `Why: ${parts.join('. ')}.` };
    });

    return { items, tookMs: Date.now() - start };
  }
}
