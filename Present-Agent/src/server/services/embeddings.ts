export interface EmbeddingsProvider {
  readonly model: string;
  embedText(text: string): Promise<number[]>;
}

export class NoopEmbeddings implements EmbeddingsProvider {
  constructor(public readonly model: string, private dim: number) {}
  async embedText(_text: string): Promise<number[]> {
    // Deterministic zero vector for scaffolding
    return Array.from({ length: this.dim }, () => 0);
  }
}

export class OpenAIEmbeddings implements EmbeddingsProvider {
  declare privateBrand: void; // keep TS happy in some ts-node configs
  // Node 18+ runtime provides fetch; declare for TS if DOM lib is absent
  declare private static _fetch?: unknown;

  constructor(
    public readonly model: string,
    private apiKey: string,
  ) {}

  async embedText(text: string): Promise<number[]> {
    const input = text?.slice(0, 8000) || ""; // guard overly long inputs
    const resp = await (globalThis as any).fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, input }),
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      throw new Error(`OpenAI embeddings error: ${resp.status} ${detail}`);
    }
    const json: any = await resp.json();
    const vec = json?.data?.[0]?.embedding;
    if (!Array.isArray(vec)) throw new Error("Invalid embeddings response");
    return vec.map((x: any) => Number(x));
  }
}
