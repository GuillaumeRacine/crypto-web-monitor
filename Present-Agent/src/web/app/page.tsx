"use client";

import { useEffect, useRef, useState } from "react";
import { chat, logMessage, getTrendingProducts, getCurrentOccasion } from "../lib/api";
import ProductCard from "../components/ProductCard";
import dynamic from "next/dynamic";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

const MicButton = dynamic(() => import("../components/MicButton"), { ssr: false });

type ChatMessage = { role: "user" | "assistant"; content: string; recs?: { product: any; score: number; rationale?: string }[] };

export default function HomePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hi! Tell me about who you're shopping for and I'll suggest thoughtful gifts." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastPrompt, setLastPrompt] = useState("");
  const [lastError, setLastError] = useState<string | null>(null);
  const [trendingIds, setTrendingIds] = useState<Set<string>>(new Set());
  const [occasionMessage, setOccasionMessage] = useState<string | null>(null);
  const [isUrgent, setIsUrgent] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  type SavedCtx = { budgetMin?: number; budgetMax?: number; notes?: string };
  const CTX_KEY = "present-agent:ctx";
  const [ctx, setCtx] = useState<SavedCtx>({});
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Load client-only context to avoid hydration mismatch
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(CTX_KEY) : null;
      if (raw) setCtx(JSON.parse(raw));
    } catch {}
  }, []);

  // Fetch trending products and occasion on mount
  useEffect(() => {
    getTrendingProducts().then(ids => setTrendingIds(new Set(ids)));
    getCurrentOccasion().then(({ message }) => setOccasionMessage(message));
  }, []);

  function parseContext(text: string): SavedCtx {
    // heuristic: extract budgets like "$40", "under $50", "between 20 and 40", "20-40"
    const out: SavedCtx = { notes: text };
    const between = text.match(/between\s*\$?(\d{1,5})\s*(and|-|to)\s*\$?(\d{1,5})/i);
    if (between) {
      const a = Number(between[1]); const b = Number(between[3]);
      out.budgetMin = Math.min(a, b); out.budgetMax = Math.max(a, b);
      return out;
    }
    const range = text.match(/\$?(\d{1,5})\s*[-–]\s*\$?(\d{1,5})/);
    if (range) {
      const a = Number(range[1]); const b = Number(range[2]);
      out.budgetMin = Math.min(a, b); out.budgetMax = Math.max(a, b);
      return out;
    }
    const under = text.match(/under\s*\$?(\d{1,5})/i);
    if (under) { out.budgetMax = Number(under[1]); return out; }
    const spend = text.match(/\b(spend|for)\s*\$?(\d{1,5})\b/i);
    if (spend) { out.budgetMax = Number(spend[2]); return out; }
    const dollars = text.match(/\b(\d{1,5})\s*dollars?\b/i);
    if (dollars) { out.budgetMax = Number(dollars[1]); return out; }
    const maxOnly = text.match(/\$([0-9]{1,5})/);
    if (maxOnly) { out.budgetMax = Number(maxOnly[1]); }
    return out;
  }

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const runChat = async (promptText: string) => {
    setLoading(true);
    setLastError(null);
    try {
      // Detect urgency in user input
      const urgencyKeywords = ['asap', 'urgent', 'urgently', 'quickly', 'quick', 'tomorrow', 'today', 'this week', 'need it soon', 'need it now', 'rush', 'fast shipping', 'expedite'];
      const hasUrgency = urgencyKeywords.some(kw => promptText.toLowerCase().includes(kw));
      setIsUrgent(hasUrgency);

      // Track minimal local context only for UX suggestions
      const parsed = parseContext(promptText); const merged: SavedCtx = { ...ctx, ...parsed };
      try { localStorage.setItem(CTX_KEY, JSON.stringify(merged)); } catch {}
      setCtx(merged);
      let attempt = 0;
      let resp: any;
      while (true) {
        try {
          resp = await chat(promptText);
          break;
        } catch (err) {
          attempt++;
          if (attempt >= 2) throw err;
          await sleep(300 * attempt);
          continue;
        }
      }
      const enrichRationale = (items: any[]) => {
        const interests: string[] = [];
        const t = promptText.toLowerCase();
        if (/(read|reader|book|novel|literature)/.test(t)) interests.push('books');
        if (/(cook|kitchen|baking|chef|cookware)/.test(t)) interests.push('kitchen');
        if (/(coffee|tea|mug)/.test(t)) interests.push('coffee & tea');
        return items.map((r: any) => {
          if (r.rationale) return r;
          const p = r.product || r;
          const reasons: string[] = [];
          if (typeof ctx.budgetMin === 'number' || typeof ctx.budgetMax === 'number') {
            const within = (typeof ctx.budgetMin !== 'number' || p.price >= ctx.budgetMin) && (typeof ctx.budgetMax !== 'number' || p.price <= ctx.budgetMax);
            if (within) reasons.push('within your budget');
          }
          if (p.category) {
            if (interests.length && interests.some((k) => p.category.toLowerCase().includes(k.split(' ')[0]))) {
              reasons.push(`matches your interests (${interests.join(', ')})`);
            } else {
              reasons.push(`category: ${p.category}`);
            }
          }
          const rationale = reasons.length ? `Why: ${reasons.join('; ')}` : undefined;
          return { ...r, rationale };
        });
      };
      if (resp.reply) setMessages((m) => [...m, { role: "assistant", content: resp.reply }]);
      if (resp.contextSummary) setMessages((m) => [...m, { role: "assistant", content: resp.contextSummary }]);
      if (resp.items?.length) setMessages((m) => [...m, { role: "assistant", content: `Here are a few ideas based on your details.`, recs: enrichRationale(resp.items) }]);
    } catch (e: any) {
      const msg = e?.message || String(e) || "Something went wrong";
      setLastError(msg);
      setMessages((m) => [...m, { role: "assistant", content: `Sorry, something went wrong. Try rephrasing your query or press Retry.` }]);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    setLastPrompt(text);
    setMessages((m) => [...m, { role: "user", content: text }]);
    try { await logMessage('user', text); } catch {}
    await runChat(text);
  };

  const onVoice = (text: string) => {
    setInput(text);
    // Auto submit for voice capture
    setTimeout(() => onSubmit(), 0);
  };

  return (
    <div className="min-h-[calc(100vh-56px-64px)]">
      {occasionMessage && (
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 px-4 text-center font-medium shadow-md">
          {occasionMessage}
        </div>
      )}
      {isUrgent && (
        <div className="bg-yellow-50 border-b border-yellow-200 py-3 px-4 text-center">
          <span className="font-semibold text-yellow-900">⚡ Urgent Request Detected</span>
          <span className="text-yellow-800 ml-2">Prioritizing items with fast shipping options</span>
        </div>
      )}
      <section className="border-b bg-gradient-to-b from-gray-50 to-white">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <h1 className="text-3xl font-extrabold tracking-tight">Find gifts they'll truly love</h1>
          <p className="mt-2 text-gray-600 max-w-2xl">Describe the person and occasion, budget, and any preferences in natural language. Voice or text — your call.</p>
        </div>
      </section>

      <main className="grid grid-rows-[1fr_auto]">
        <div ref={listRef} className="overflow-y-auto p-4">
          <div className="mx-auto max-w-4xl grid gap-3">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`${m.role === 'user' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900 border border-gray-200'} shadow-sm rounded-xl p-4 max-w-[80%]`}>
                  <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                  {m.recs?.length ? (
                    <>
                      {/* Comparison Mode Toolbar */}
                      {m.recs.length > 1 && (
                        <div className="mt-3 flex items-center gap-3 text-sm">
                          <Button
                            size="sm"
                            variant={comparisonMode ? "default" : "outline"}
                            onClick={() => setComparisonMode(!comparisonMode)}
                          >
                            {comparisonMode ? "Exit Compare" : "Compare Options"}
                          </Button>
                          {comparisonMode && (
                            <span className="text-gray-600">
                              Select products to compare ({selectedProducts.size} selected)
                            </span>
                          )}
                        </div>
                      )}

                      <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
                        {m.recs.map((r: any) => (
                          <div key={r.product.id} className="relative">
                            {comparisonMode && (
                              <div className="absolute top-2 right-2 z-20">
                                <input
                                  type="checkbox"
                                  checked={selectedProducts.has(r.product.id)}
                                  onChange={(e) => {
                                    const newSet = new Set(selectedProducts);
                                    if (e.target.checked) {
                                      newSet.add(r.product.id);
                                    } else {
                                      newSet.delete(r.product.id);
                                    }
                                    setSelectedProducts(newSet);
                                  }}
                                  className="h-5 w-5 rounded border-gray-300 cursor-pointer"
                                />
                              </div>
                            )}
                            <ProductCard
                              p={r.product}
                              rationale={r.rationale}
                              isTrending={trendingIds.has(r.product.id)}
                              budgetMin={ctx.budgetMin}
                              budgetMax={ctx.budgetMax}
                              showValue={true}
                              isUrgent={isUrgent}
                              matchScore={r.score}
                            />
                          </div>
                        ))}
                      </div>

                      {/* Quick Filters */}
                      {m.recs && m.recs.length > 3 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className="text-sm text-gray-600">Quick filters:</span>
                          <button
                            onClick={() => {
                              const cheaper = (m.recs || []).filter((r: any) => r.product.price < (ctx.budgetMax || 100)).slice(0, 3);
                              setMessages((msgs) => [...msgs, { role: "assistant", content: "Here are more affordable options:", recs: cheaper }]);
                            }}
                            className="text-xs px-3 py-1 rounded-full border border-gray-300 hover:bg-gray-50"
                          >
                            Show Cheaper Options
                          </button>
                          <button
                            onClick={() => {
                              const sorted = [...(m.recs || [])].sort((a: any, b: any) => (b.score || 0) - (a.score || 0)).slice(0, 3);
                              setMessages((msgs) => [...msgs, { role: "assistant", content: "Top matches by score:", recs: sorted }]);
                            }}
                            className="text-xs px-3 py-1 rounded-full border border-gray-300 hover:bg-gray-50"
                          >
                            Show Best Matches
                          </button>
                        </div>
                      )}
                    </>
                  ) : null}
                  {!loading && lastError && idx === messages.length - 1 && (
                    <div className="mt-3 flex items-center gap-3 text-sm">
                      <span className="text-red-600">{lastError}</span>
                      <Button type="button" onClick={() => runChat(lastPrompt)}>Retry</Button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {messages.length <= 1 && !loading && (
              <div className="flex justify-start">
                <div className="bg-white text-gray-900 border border-gray-200 shadow-sm rounded-xl p-4 max-w-[80%]">
                  <div className="text-sm text-gray-600 mb-2">Try one of these:</div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "Gift for my mom's 60th birthday, $50-100",
                      "Anniversary gift for my partner, loves cooking",
                      "Thank you gift for colleague, under $30",
                    ].map((ex) => (
                      <button
                        key={ex}
                        onClick={() => { setInput(ex); setTimeout(() => onSubmit(), 0); }}
                        className="rounded-full border border-gray-200 px-3 py-1 text-sm hover:bg-gray-50"
                        type="button"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white text-gray-900 border border-gray-200 shadow-sm rounded-xl p-4 max-w-[80%]">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="inline-flex animate-pulse">Thinking</span>
                    <span className="inline-flex h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.2s]"></span>
                    <span className="inline-flex h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0s]"></span>
                    <span className="inline-flex h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0.2s]"></span>
                  </div>
                  <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-64 animate-pulse rounded-xl bg-gray-100" />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={onSubmit} className="sticky bottom-0 border-t border-gray-200 bg-white p-3">
          <div className="mx-auto max-w-4xl flex">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g., Shopping for my sister’s birthday, loves baking, budget $40"
              className="flex-1"
              aria-label="Message"
            />
            <MicButton onResult={onVoice} disabled={loading} />
            <Button type="submit" disabled={loading} className="ml-2 inline-flex items-center gap-2" aria-label="Send">
              {loading ? (<>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>
                Thinking...
              </>) : "Send"}
            </Button>
          </div>
          {(ctx.budgetMin != null || ctx.budgetMax != null) && (
            <div className="mx-auto max-w-4xl mt-2 flex items-center gap-2 text-xs text-gray-600">
              <span className="rounded-full bg-gray-100 px-2 py-1">Budget: {ctx.budgetMin ?? '—'}–{ctx.budgetMax ?? '—'}</span>
            </div>
          )}
        </form>
      </main>
    </div>
  );
}
