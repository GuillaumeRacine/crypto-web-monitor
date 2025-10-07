"use client";

import { useEffect, useState } from "react";
import { getCategories, getVendors } from "../../../lib/api";

export default function MappingsPage() {
  const [vendors, setVendors] = useState<string[]>([]);
  const [vendor, setVendor] = useState<string>("");
  const [categories, setCategories] = useState<string[]>([]);
  const [rows, setRows] = useState<{ category: string; mappedTo: string | null }[]>([]);
  const [targetBySrc, setTargetBySrc] = useState<Record<string, string>>( {} );
  const [status, setStatus] = useState<string>("");

  useEffect(() => { getVendors().then(setVendors).catch(()=>setVendors([])); getCategories().then(setCategories).catch(()=>setCategories([])); }, []);
  useEffect(() => { if (!vendor) return; load(); }, [vendor]);

  async function load() {
    setStatus("Loading...");
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';
      const resp = await fetch(`${base}/api/admin/vendor_categories?vendor=${encodeURIComponent(vendor)}`);
      const json = await resp.json();
      const items = (json.items || []) as { category: string; mappedTo: string | null }[];
      setRows(items);
      const map: Record<string,string> = {};
      for (const r of items) if (r.mappedTo) map[r.category] = r.mappedTo;
      setTargetBySrc(map);
      setStatus("");
    } catch (e:any) {
      setStatus(`Error: ${e?.message || e}`);
    }
  }

  async function save(category: string) {
    const target = targetBySrc[category];
    if (!vendor || !category || !target) return;
    setStatus("Saving...");
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';
      const res = await fetch(`${base}/api/admin/mappings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vendor, sourceCategory: category, targetCategory: target, rule: 'manual', confidence: 1.0 }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus("Saved");
      setTimeout(()=> setStatus(""), 1000);
      load();
    } catch (e:any) {
      setStatus(`Error: ${e?.message || e}`);
    }
  }

  return (
    <div className="p-4">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold mb-2">Category Mappings</h1>
        <p className="text-sm text-gray-600 mb-2">Map vendor-specific category names to your canonical taxonomy. New imports will use these mappings automatically.</p>
        <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
          <div className="font-medium">Canonical Taxonomy</div>
          <div className="mt-1">The canonical taxonomy is defined in <code className="bg-blue-100 px-1 rounded">data/canonical_taxonomy.json</code>. Map all vendor categories to these standard categories for consistent recommendations and graph traversal.</div>
        </div>
        <div className="mb-3 flex items-center gap-2">
          <select value={vendor} onChange={(e)=> setVendor(e.target.value)} className="h-9 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
            <option value="">Select vendor…</option>
            {vendors.map(v=> <option key={v} value={v}>{v}</option>)}
          </select>
          {status && <div className="text-xs text-gray-600">{status}</div>}
        </div>
        {vendor && (
          <div className="overflow-auto rounded-lg border border-gray-200">
            <table className="min-w-full table-fixed text-left text-sm">
              <colgroup>
                <col />
                <col />
                <col className="w-[12ch]" />
              </colgroup>
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-3 py-2">Source Category</th>
                  <th className="px-3 py-2">Map To</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={3} className="px-3 py-8 text-center text-gray-500">No categories found for this vendor.</td></tr>
                ) : rows.map(r => (
                  <tr key={r.category} className="border-t border-gray-100">
                    <td className="px-3 py-2">{r.category}</td>
                    <td className="px-3 py-2">
                      <select value={targetBySrc[r.category] || r.mappedTo || ''} onChange={(e)=> setTargetBySrc(prev => ({ ...prev, [r.category]: e.target.value }))} className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
                        <option value="">— Select —</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={()=> save(r.category)} disabled={!targetBySrc[r.category]} className="inline-flex h-9 items-center rounded-md bg-gray-900 px-3 text-sm text-white disabled:opacity-50">Save</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

