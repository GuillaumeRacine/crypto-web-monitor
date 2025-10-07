"use client";

import { useEffect, useMemo, useState } from "react";
import { productsAudit, getCategories, getVendors } from "../../../lib/api";
import Link from "next/link";

type Row = {
  id: string;
  title: string;
  description?: string | null;
  vendor?: string | null;
  category?: string | null;
  price: number;
  currency?: string;
  available: boolean;
  imageUrl?: string | null;
  productUrl: string;
  tags?: string[];
  attributes?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export default function ProductsAuditPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("");
  const [vendor, setVendor] = useState<string>("");
  const [vendors, setVendors] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<'id'|'title'|'vendor'|'category'|'price'|'available'|'updated'|'created'>('updated');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');

  const offset = useMemo(() => (page - 1) * pageSize, [page, pageSize]);
  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  async function load() {
    setLoading(true);
    try {
      const data = await productsAudit({ text: q || undefined, category: category || undefined, vendor: vendor || undefined, limit: pageSize, offset, sort: sortKey, order: sortDir });
      setRows(data.items);
      setTotal(data.total);
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    getCategories().then(setCategories).catch(() => setCategories([]));
    getVendors().then(setVendors).catch(()=> setVendors([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, sortKey, sortDir]);

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="p-4">
      <div className="mx-auto max-w-[98vw]">
        <h1 className="text-2xl font-bold mb-3">Products Audit</h1>
        <p className="text-sm text-gray-600 mb-4">Internal table view for auditing catalog data. Shows Postgres-backed products with vendor and category joins.</p>

        <form onSubmit={applyFilters} className="mb-4 grid grid-cols-1 md:grid-cols-6 gap-2">
          <input className="h-9 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title/description" />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={vendor} onChange={(e)=> setVendor(e.target.value)} className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
            <option value="">All vendors</option>
            {vendors.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
            {[50,100,200,500].map(n => <option key={n} value={n}>{n}/page</option>)}
          </select>
          <div className="flex items-center gap-2">
            <button type="submit" className="inline-flex h-9 items-center rounded-md bg-gray-900 px-3 text-sm text-white">Apply</button>
            <button type="button" onClick={()=>{ setQ(""); setCategory(""); setVendor(""); setPage(1); load(); }} className="inline-flex h-9 items-center rounded-md border border-gray-200 px-3 text-sm">Clear</button>
          </div>
          <div className="flex items-center justify-end text-sm text-gray-600">Total: {total.toLocaleString()}</div>
        </form>

        <div className="overflow-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                {([
                  ['id','ID'],['title','Title'],['vendor','Vendor'],['category','Category'],['price','Price'],['available','Avail.'],['updated','Updated']
                ] as const).map(([key,label]) => (
                  <th key={key} className="px-3 py-2 cursor-pointer select-none" onClick={()=>{
                    const k = key as typeof sortKey;
                    if (sortKey === k) setSortDir(d => d==='asc'?'desc':'asc'); else { setSortKey(k); setSortDir('asc'); }
                  }}>
                    <span className="inline-flex items-center gap-1">
                      {label}
                      {sortKey===key && (<span className="text-gray-500">{sortDir==='asc'?'▲':'▼'}</span>)}
                    </span>
                  </th>
                ))}
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-500">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-500">No results</td></tr>
              ) : (
                rows.map(r => (
                  <>
                    <tr key={r.id} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-mono text-xs">{r.id}</td>
                      <td className="px-3 py-2">{r.title}</td>
                      <td className="px-3 py-2">{r.vendor || "—"}</td>
                      <td className="px-3 py-2">{r.category || "—"}</td>
                      <td className="px-3 py-2">{(r.currency || 'USD')} {r.price.toFixed(2)}</td>
                      <td className="px-3 py-2">{r.available ? 'Yes' : 'No'}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '—'}</td>
                      <td className="px-3 py-2 flex items-center gap-2">
                        <button onClick={() => toggle(r.id)} className="text-blue-600 hover:underline">{expanded[r.id] ? 'Collapse' : 'Expand'}</button>
                        <Link href={`/products/${encodeURIComponent(r.id)}`} className="text-blue-600 hover:underline">Details</Link>
                        <a href={r.productUrl} target="_blank" rel="noreferrer" className="text-gray-700 hover:underline">Open URL</a>
                      </td>
                    </tr>
                    {expanded[r.id] && (
                      <tr className="bg-gray-50 border-t border-gray-100">
                        <td colSpan={8} className="px-3 py-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <div className="text-xs uppercase text-gray-500">Image</div>
                              {r.imageUrl ? <img src={r.imageUrl} alt={r.title} className="mt-2 h-40 rounded-md object-cover" /> : <div className="mt-2 h-40 rounded-md bg-gray-200" />}
                            </div>
                            <div>
                              <div className="text-xs uppercase text-gray-500">Description</div>
                              <div className="mt-2 text-sm whitespace-pre-wrap">{r.description || '—'}</div>
                            </div>
                            <div>
                              <div className="text-xs uppercase text-gray-500">Tags / Attributes</div>
                              <div className="mt-2 text-sm"><pre className="whitespace-pre-wrap break-words">{JSON.stringify({ tags: r.tags || [], attributes: r.attributes || {} }, null, 2)}</pre></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">Page {page} / {pageCount} · Showing {(Math.min(total, offset + rows.length)).toLocaleString()} of {total.toLocaleString()}</div>
          <div className="flex items-center gap-2">
            <button disabled={page<=1} onClick={()=>setPage(1)} className="inline-flex h-9 items-center rounded-md border border-gray-200 px-3 text-sm disabled:opacity-50">First</button>
            <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="inline-flex h-9 items-center rounded-md border border-gray-200 px-3 text-sm disabled:opacity-50">Prev</button>
            <button disabled={page>=pageCount} onClick={()=>setPage(p=>Math.min(pageCount,p+1))} className="inline-flex h-9 items-center rounded-md border border-gray-200 px-3 text-sm disabled:opacity-50">Next</button>
            <button disabled={page>=pageCount} onClick={()=>setPage(pageCount)} className="inline-flex h-9 items-center rounded-md border border-gray-200 px-3 text-sm disabled:opacity-50">Last</button>
          </div>
        </div>
      </div>
    </div>
  );
}
