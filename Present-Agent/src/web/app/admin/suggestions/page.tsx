"use client";

import { useEffect, useState } from "react";

type Suggest = { id: number; product_id: string; suggested_category_id: number; confidence: number; status: string; title: string; category_name?: string };

export default function SuggestionsPage() {
  const [items, setItems] = useState<Suggest[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'pending'|'accepted'|'rejected'>('pending');

  async function load() {
    setLoading(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';
      const r = await fetch(`${base}/api/admin/suggestions?status=${status}`);
      const j = await r.json();
      setItems(j.items || []);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [status]);

  async function act(id: number, action: 'accept'|'reject', mode: 'primary'|'additional' = 'additional') {
    const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';
    await fetch(`${base}/api/admin/suggestions/${id}?action=${action}&mode=${mode}`, { method: 'POST' });
    await load();
  }

  return (
    <div className="p-4">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold mb-2">Category Suggestions</h1>
        <p className="text-sm text-gray-600 mb-3">Accept suggestions as primary category (overwrites if empty) or add as additional category.</p>
        <div className="mb-3">
          <select value={status} onChange={(e)=> setStatus(e.target.value as any)} className="h-9 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div className="overflow-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Suggested Category</th>
                <th className="px-3 py-2">Confidence</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="px-3 py-8 text-center text-gray-500">Loading…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-8 text-center text-gray-500">No suggestions</td></tr>
              ) : items.map((s) => (
                <tr key={s.id} className="border-t border-gray-100">
                  <td className="px-3 py-2">
                    <div className="font-medium">{s.title || s.product_id}</div>
                    <div className="text-xs text-gray-500">{s.product_id}</div>
                  </td>
                  <td className="px-3 py-2">{s.category_name || s.suggested_category_id}</td>
                  <td className="px-3 py-2">{s.confidence}</td>
                  <td className="px-3 py-2 flex items-center gap-2">
                    <button onClick={()=> act(s.id, 'accept', 'primary')} className="inline-flex h-8 items-center rounded-md bg-gray-900 px-2 text-xs text-white">Accept as Primary</button>
                    <button onClick={()=> act(s.id, 'accept', 'additional')} className="inline-flex h-8 items-center rounded-md border border-gray-200 px-2 text-xs">Add as Additional</button>
                    <button onClick={()=> act(s.id, 'reject')} className="inline-flex h-8 items-center rounded-md border border-gray-200 px-2 text-xs">Reject</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

