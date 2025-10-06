export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class OpenAIChat {
  constructor(private apiKey: string, private model: string = 'gpt-4o-mini') {}

  async chat(messages: ChatMessage[], temperature = 0.4, modelOverride?: string): Promise<string> {
    const res = await (globalThis as any).fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: modelOverride || this.model, messages, temperature, max_tokens: 350 }),
    });
    if (!res.ok) throw new Error(`OpenAI chat error: ${res.status} ${await res.text().catch(()=> '')}`);
    const json: any = await res.json();
    const text = json?.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('Empty completion');
    return text;
  }
}
