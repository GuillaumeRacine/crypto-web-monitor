/**
 * Reranking service using Cohere's rerank API for improved relevance
 * Falls back to original ranking if Cohere is not configured
 */

import { CohereClient } from "cohere-ai";
import type { Product } from "../types.js";

export interface RerankerResult {
  index: number;
  relevanceScore: number;
}

export class RerankService {
  private cohere?: CohereClient;
  private enabled: boolean;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.cohere = new CohereClient({ token: apiKey });
      this.enabled = true;
    } else {
      this.enabled = false;
    }
  }

  /**
   * Rerank products using Cohere's rerank model
   * @param query - User's search query
   * @param products - Candidate products to rerank
   * @param topN - Number of top results to return
   * @returns Reranked products with relevance scores
   */
  async rerank(
    query: string,
    products: Array<{ product: Product; score: number }>,
    topN: number = 5
  ): Promise<Array<{ product: Product; score: number; rerankScore?: number }>> {
    if (!this.enabled || !this.cohere || products.length === 0) {
      // Fallback: return original ranking
      return products.slice(0, topN);
    }

    try {
      // Build documents from products (title + description)
      const documents = products.map((item) => {
        const parts = [
          item.product.title,
          item.product.description || "",
          item.product.category || "",
          item.product.vendor || "",
        ];
        return parts.filter(Boolean).join(" | ");
      });

      // Call Cohere rerank API
      const response = await this.cohere.rerank({
        query,
        documents,
        topN,
        model: "rerank-english-v3.0", // Best reranking model
      });

      if (!response.results || response.results.length === 0) {
        return products.slice(0, topN);
      }

      // Map reranked results back to products
      const reranked = response.results.map((result) => {
        const originalItem = products[result.index];
        return {
          ...originalItem,
          rerankScore: result.relevanceScore,
          // Combine original semantic score with rerank score
          score: originalItem.score * 0.3 + result.relevanceScore * 0.7,
        };
      });

      if (process.env.LOG_LEVEL === "debug") {
        console.debug(
          `[rerank] Reranked ${products.length} -> ${reranked.length} products`
        );
        reranked.slice(0, 3).forEach((item, i) => {
          console.debug(
            `  ${i + 1}. ${item.product.title} (semantic: ${item.rerankScore?.toFixed(3)}, final: ${item.score.toFixed(3)})`
          );
        });
      }

      return reranked;
    } catch (error: any) {
      console.warn("[rerank] Cohere reranking failed:", error.message);
      // Fallback to original ranking
      return products.slice(0, topN);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}
