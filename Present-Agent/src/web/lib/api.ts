export type SearchItem = {
  id: string;
  title: string;
  description?: string | null;
  price: number;
  currency?: string;
  imageUrl?: string | null;
  productUrl: string;
  vendor?: string | null;
  category?: string | null;
};

export type RecommendedItem = {
  product: SearchItem;
  score: number;
  rationale?: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3001";

export async function recommend(query: { text: string; budgetMin?: number; budgetMax?: number; categories?: string[]; limit?: number; recipientId?: string }) {
  const body: any = { query: { text: query.text, budgetMin: query.budgetMin, budgetMax: query.budgetMax, categories: query.categories, limit: query.limit } };
  if (query.recipientId) body.recipientId = query.recipientId;
  const res = await fetch(`${API_BASE}/api/recommend`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: 'include', body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Recommend failed: ${res.status}`);
  const json = await res.json();
  return json.items as RecommendedItem[];
}

export async function getProduct(id: string): Promise<{ item: SearchItem; facets: { facet_key: string; facet_value: string; confidence?: number; source?: string }[]; suggestions: { suggested_category_id: number; confidence: number; status: string }[]; additionalCategories: string[] }> {
  const res = await fetch(`${API_BASE}/api/products/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Product fetch failed: ${res.status}`);
  const json = await res.json();
  return json as { item: SearchItem; facets: { facet_key: string; facet_value: string; confidence?: number; source?: string }[]; suggestions: { suggested_category_id: number; confidence: number; status: string }[]; additionalCategories: string[] };
}

export async function search(text: string) {
  const res = await fetch(`${API_BASE}/api/search?text=${encodeURIComponent(text)}`);
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  const json = await res.json();
  return json.items as SearchItem[];
}

export async function searchProducts(params: { text?: string; budgetMin?: number; budgetMax?: number; category?: string; limit?: number; offset?: number }) {
  const sp = new URLSearchParams();
  if (params.text) sp.set("text", params.text);
  if (typeof params.budgetMin === "number") sp.set("budgetMin", String(params.budgetMin));
  if (typeof params.budgetMax === "number") sp.set("budgetMax", String(params.budgetMax));
  if (params.category) sp.append("category", params.category);
  if (typeof params.limit === "number") sp.set("limit", String(params.limit));
  if (typeof params.offset === "number") sp.set("offset", String(params.offset));
  const res = await fetch(`${API_BASE}/api/search?${sp.toString()}`);
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  const json = await res.json();
  return json.items as SearchItem[];
}

export async function sendFeedback(payload: { productId: string; rating: number; comment?: string; userId?: string; recipientId?: string }) {
  const res = await fetch(`${API_BASE}/api/feedback`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: 'include', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`Feedback failed: ${res.status}`);
  return res.json();
}

export async function getCategories() {
  const res = await fetch(`${API_BASE}/api/categories`);
  if (!res.ok) throw new Error(`Categories failed: ${res.status}`);
  const json = await res.json();
  return (json.items as string[]) || [];
}

export async function getVendors() {
  const res = await fetch(`${API_BASE}/api/vendors`);
  if (!res.ok) throw new Error(`Vendors failed: ${res.status}`);
  const json = await res.json();
  return (json.items as string[]) || [];
}

export async function productsAudit(params: { text?: string; category?: string; vendor?: string; limit?: number; offset?: number; sort?: string; order?: 'asc'|'desc' }) {
  const sp = new URLSearchParams();
  if (params.text) sp.set('text', params.text);
  if (params.category) sp.set('category', params.category);
  if (params.vendor) sp.set('vendor', params.vendor);
  if (typeof params.limit === 'number') sp.set('limit', String(params.limit));
  if (typeof params.offset === 'number') sp.set('offset', String(params.offset));
  if (params.sort) sp.set('sort', params.sort);
  if (params.order) sp.set('order', params.order);
  const res = await fetch(`${API_BASE}/api/products_audit?${sp.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Products audit failed: ${res.status}`);
  return res.json() as Promise<{ items: any[]; total: number; limit: number; offset: number }>;
}

export async function setProductCategory(productId: string, category: string, mode: 'primary'|'additional' = 'primary') {
  const res = await fetch(`${API_BASE}/api/products/${encodeURIComponent(productId)}/category?mode=${mode}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ category }),
  });
  if (!res.ok) throw new Error(`Set category failed: ${res.status}`);
  return res.json();
}

export async function logMessage(role: 'user'|'assistant', content: string) {
  const res = await fetch(`${API_BASE}/api/chat/log`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ role, content }) });
  if (!res.ok) throw new Error(`Log failed: ${res.status}`);
  return res.json();
}

export async function chat(message: string) {
  const res = await fetch(`${API_BASE}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ message }) });
  if (!res.ok) throw new Error(`Chat failed: ${res.status}`);
  return res.json();
}

// Auth helpers
export async function signup(email: string, name?: string) {
  const res = await fetch(`${API_BASE}/api/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ email, name }) });
  if (!res.ok) throw new Error(`Signup failed: ${res.status}`);
  return res.json();
}

export async function me() {
  const res = await fetch(`${API_BASE}/api/me`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Me failed: ${res.status}`);
  return res.json();
}

export async function logout() {
  const res = await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' });
  if (!res.ok) throw new Error(`Logout failed: ${res.status}`);
  return res.json();
}

export async function saveContext(data: { notes?: string; budgetMin?: number; budgetMax?: number; categories?: string[]; vendors?: string[]; values?: string[] }) {
  const res = await fetch(`${API_BASE}/api/context`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(data) });
  if (!res.ok) throw new Error(`Context save failed: ${res.status}`);
  return res.json();
}

export async function getContext() {
  const res = await fetch(`${API_BASE}/api/context`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Context fetch failed: ${res.status}`);
  return res.json();
}

export async function deleteContext() {
  const res = await fetch(`${API_BASE}/api/context`, { method: 'DELETE', credentials: 'include' });
  if (!res.ok) throw new Error(`Context delete failed: ${res.status}`);
  return res.json();
}

export async function deleteRecipientContext(recipient: string) {
  const res = await fetch(`${API_BASE}/api/context?recipient=${encodeURIComponent(recipient)}`, { method: 'DELETE', credentials: 'include' });
  if (!res.ok) throw new Error(`Recipient context delete failed: ${res.status}`);
  return res.json();
}

export async function getRecipients() {
  const res = await fetch(`${API_BASE}/api/recipients`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Recipients fetch failed: ${res.status}`);
  return res.json();
}

export async function trackProductView(productId: string) {
  try {
    await fetch(`${API_BASE}/api/track/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ productId })
    });
  } catch (e) {
    // Silent fail - tracking shouldn't break UX
  }
}

export async function trackProductClick(productId: string) {
  try {
    await fetch(`${API_BASE}/api/track/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ productId })
    });
  } catch (e) {
    // Silent fail - tracking shouldn't break UX
  }
}

export async function getTrendingProducts(): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}/api/trending`, { cache: 'no-store' });
    if (!res.ok) return [];
    const json = await res.json();
    return json.trendingIds || [];
  } catch (e) {
    return [];
  }
}

export async function getCurrentOccasion(): Promise<{ occasion: any; message: string | null }> {
  try {
    const res = await fetch(`${API_BASE}/api/occasions/current`, { cache: 'no-store' });
    if (!res.ok) return { occasion: null, message: null };
    const json = await res.json();
    return { occasion: json.occasion, message: json.message };
  } catch (e) {
    return { occasion: null, message: null };
  }
}
