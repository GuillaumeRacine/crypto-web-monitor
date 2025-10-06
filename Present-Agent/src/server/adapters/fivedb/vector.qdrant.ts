import { Product, VectorIndex } from "../../types.js";
import { EmbeddingsProvider } from "../../services/embeddings.js";

type QdrantPoint = {
  id: string;
  vector: number[];
  payload?: Record<string, unknown>;
};

export class QdrantIndex implements VectorIndex {
  constructor(
    private url: string,
    private collection: string,
    private dim: number,
    private embed: EmbeddingsProvider,
    private apiKey?: string,
  ) {}

  // Convert large integer IDs to UUID format for Qdrant
  private idToUUID(id: string): string {
    // Pad with zeros to make it 32 hex characters
    const hex = BigInt(id).toString(16).padStart(32, '0');
    // Format as UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20, 32)}`;
  }

  // Convert UUID back to original ID (reverse of idToUUID)
  private uuidToID(uuid: string): string {
    const hex = uuid.replace(/-/g, '');
    return BigInt('0x' + hex).toString();
  }

  private async ensureCollection(): Promise<void> {
    const u = new URL(`/collections/${encodeURIComponent(this.collection)}`, this.url);
    // Try create idempotently
    const resp = await (globalThis as any).fetch(u.toString(), {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}) },
      body: JSON.stringify({
        vectors: { size: this.dim, distance: "Cosine" },
      }),
    });
    if (!resp.ok && resp.status !== 409) {
      const detail = await resp.text().catch(() => "");
      throw new Error(`Qdrant ensureCollection failed: ${resp.status} ${detail}`);
    }
  }

  private productToText(p: Product): string {
    const parts = [p.title, p.description || "", p.vendor || "", p.category || "", (p.tags || []).join(" ")];
    return parts.filter(Boolean).join(" \n ");
  }

  async upsertProducts(products: Product[]): Promise<void> {
    if (products.length === 0) return;
    await this.ensureCollection();
    const points: QdrantPoint[] = [];
    for (const p of products) {
      const text = this.productToText(p);
      const vector = await this.embed.embedText(text);
      // Use UUID format for large integer IDs (Qdrant requirement)
      const uuid = this.idToUUID(String(p.id));
      points.push({
        id: uuid,
        vector,
        payload: {
          id: String(p.id),
          title: p.title,
          price: p.price,
          currency: p.currency || "USD",
          vendor: p.vendor || null,
          category: p.category || null,
          available: !!p.available,
          product_url: p.productUrl,
          tags: p.tags || [],
        },
      });
    }
    // Batch upsert
    const u = new URL(`/collections/${encodeURIComponent(this.collection)}/points`, this.url);
    const resp = await (globalThis as any).fetch(u.toString(), {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}) },
      body: JSON.stringify({ points }),
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      throw new Error(`Qdrant upsert failed: ${resp.status} ${detail}`);
    }
  }

  async search(query: string, k: number, filters?: Record<string, unknown>): Promise<{ id: string; score: number }[]> {
    await this.ensureCollection();
    const vector = await this.embed.embedText(query);
    const body: any = {
      vector,
      limit: k,
      with_payload: true, // Request payload data
    };
    const filter: any = { must: [] as any[] };
    if (filters) {
      const { budgetMin, budgetMax, categories } = filters as any;
      if (typeof budgetMin === "number") filter.must.push({ key: "price", range: { gte: budgetMin } });
      if (typeof budgetMax === "number") filter.must.push({ key: "price", range: { lte: budgetMax } });
      // Categories removed - let semantic search find matches across all categories
      // if (Array.isArray(categories) && categories.length > 0) filter.must.push({ key: "category", match: { any: categories } });
    }
    if (filter.must.length > 0) body.filter = filter;
    const u = new URL(`/collections/${encodeURIComponent(this.collection)}/points/search`, this.url);
    const resp = await (globalThis as any).fetch(u.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}) },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      throw new Error(`Qdrant search failed: ${resp.status} ${detail}`);
    }
    const json: any = await resp.json();
    const result = (json?.result || []) as Array<{ id: string | number; score: number; payload?: any }>;
    // Use the original product ID from payload, not the UUID
    return result.map((r) => ({ id: r.payload?.id || this.uuidToID(String(r.id)), score: Number(r.score) }));
  }
}
