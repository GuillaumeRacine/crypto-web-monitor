"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Row = {
  product_id: string;
  title?: string;
  image_url?: string | null;
  product_url?: string;
  category_name?: string | null;
  method: 'suggestion' | 'vendor_majority' | 'global_top' | string;
  ts: string;
};

export default function AutoCategoriesAudit() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState<'all'|'suggestion'|'vendor_majority'|'global_top'>('all');

  async function load() {
    setLoading(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';
      const r = await fetch(`${base}/api/admin/auto_categories?method=${method}&limit=200`);
      const j = await r.json();
      setItems(j.items || []);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [method]);

  return (
    <div className="p-4">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold mb-2">Auto‑Assigned Categories</h1>
        <p className="text-sm text-gray-600 mb-3">Review products whose categories were auto‑assigned during ensure:categories. Filter by method to prioritize reviews.</p>
        <div className="mb-3">
          <select value={method} onChange={(e)=> setMethod(e.target.value as any)} className="h-9 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
            <option value="all">All methods</option>
            <option value="suggestion">Suggestion (top)</option>
            <option value="vendor_majority">Vendor majority</option>
            <option value="global_top">Global top</option>
          </select>
        </div>
        <div className="overflow-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Assigned Category</th>
                <th className="px-3 py-2">Method</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-500">Loading…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-500">No records</td></tr>
              ) : items.map((row, i) => (
                <tr key={`${row.product_id}-${row.ts}-${i}`} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-xs text-gray-500">{new Date(row.ts).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{row.title || row.product_id}</div>
                    <div className="text-xs text-gray-500">{row.product_id}</div>
                  </td>
                  <td className="px-3 py-2">{row.category_name || '—'}</td>
                  <td className="px-3 py-2">{row.method}</td>
                  <td className="px-3 py-2 flex items-center gap-3">
                    <Link href={`/products/${encodeURIComponent(row.product_id)}`} className="text-blue-600 hover:underline">Details</Link>
                    {row.product_url ? <a href={row.product_url} target="_blank" rel="noreferrer" className="text-gray-700 hover:underline">Open URL</a> : null}
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

