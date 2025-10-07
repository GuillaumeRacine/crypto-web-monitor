"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { productsAudit, getCategories, getVendors } from "../../lib/api";

type Row = {
  id: string;
  title: string;
  description?: string | null;
  vendor?: string | null;
  category?: string | null;
  price: number;
  currency?: string;
  available: boolean;
  productUrl: string;
  sourceWebsite?: string | null;
  updatedAt?: string;
};

export default function ProductsIndex() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("");
  const [vendor, setVendor] = useState<string>("");
  const [vendors, setVendors] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(200); // 100+ per page by default
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<'id'|'title'|'vendor'|'category'|'price'|'available'|'updated'|'created'>('updated');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');
  const [globalCategoryCounts, setGlobalCategoryCounts] = useState<[string, number][]>([]);

  const offset = useMemo(() => (page - 1) * pageSize, [page, pageSize]);
  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const data = await productsAudit({ text: q || undefined, category: category || undefined, vendor: vendor || undefined, limit: pageSize, offset, sort: sortKey, order: sortDir });
      setRows(data.items as any);
      setTotal(data.total);
    } catch {
      setRows([]);
      setTotal(0);
      setErr('Failed to load products. Check that the API is running and Postgres has data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    getCategories().then(setCategories).catch(() => setCategories([]));
    getVendors().then(setVendors).catch(() => setVendors([]));
    // Fetch all products to get global category counts (use a large limit)
    productsAudit({ limit: 5000, offset: 0 }).then(data => {
      const categoryCount: Record<string, number> = {};
      data.items.forEach((r: any) => {
        const cat = r.category || 'None';
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
      });
      const sorted = Object.entries(categoryCount).sort((a, b) => b[1] - a[1]);
      setGlobalCategoryCounts(sorted);
    }).catch(() => setGlobalCategoryCounts([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, sortKey, sortDir]);

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  const stats = useMemo(() => {
    const available = rows.filter(r => r.available).length;
    const categorized = rows.filter(r => r.category && r.category !== 'Uncategorized').length;
    const uniqueVendors = new Set(rows.map(r => r.vendor).filter(Boolean)).size;

    return { available, categorized, uniqueVendors };
  }, [rows]);

  return (
    <div className="p-3">
      <div className="mx-auto max-w-[98vw]">
        <h1 className="text-2xl font-bold mb-3">Products</h1>

        {/* Key metrics card */}
        <div className="mb-3 grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-gray-50 border border-gray-200 rounded text-xs">
          <div className="grid grid-cols-4 gap-2">
            <div>
              <div className="font-semibold text-gray-500 uppercase">Total</div>
              <div className="text-lg font-bold">{total.toLocaleString()}</div>
            </div>
            <div>
              <div className="font-semibold text-gray-500 uppercase">Available</div>
              <div className="text-lg font-bold">{stats.available}/{rows.length}</div>
            </div>
            <div>
              <div className="font-semibold text-gray-500 uppercase">Categorized</div>
              <div className="text-lg font-bold">{stats.categorized}/{rows.length}</div>
            </div>
            <div>
              <div className="font-semibold text-gray-500 uppercase">Vendors</div>
              <div className="text-lg font-bold">{stats.uniqueVendors}</div>
            </div>
          </div>
          <div>
            <div className="font-semibold text-gray-500 uppercase mb-1">Top Categories</div>
            <div className="flex flex-wrap gap-1">
              {globalCategoryCounts.slice(0, 10).map(([cat, count]) => (
                <div key={cat} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-gray-300 rounded text-[10px] whitespace-nowrap">
                  <span className="font-medium">{cat}</span>
                  <span className="text-gray-500">({count})</span>
                </div>
              ))}
              {globalCategoryCounts.length === 0 && (
                <span className="text-gray-400 text-xs">Loading...</span>
              )}
            </div>
          </div>
        </div>

        <form onSubmit={applyFilters} className="mb-2 grid grid-cols-1 md:grid-cols-6 gap-2">
          <input className="h-8 w-full rounded border border-gray-300 px-2 text-xs" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-8 w-full rounded border border-gray-300 bg-white px-2 text-xs">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={vendor} onChange={(e)=> setVendor(e.target.value)} className="h-8 w-full rounded border border-gray-300 bg-white px-2 text-xs">
            <option value="">All vendors</option>
            {vendors.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="h-8 w-full rounded border border-gray-300 bg-white px-2 text-xs">
            {[100,200,500].map(n => <option key={n} value={n}>{n}/pg</option>)}
          </select>
          <div className="flex items-center gap-1">
            <button type="submit" className="h-8 rounded bg-gray-900 px-3 text-xs text-white">Go</button>
            <button type="button" onClick={()=>{ setQ(""); setCategory(""); setVendor(""); setPage(1); load(); }} className="h-8 rounded border border-gray-300 px-2 text-xs">Clear</button>
          </div>
        </form>

        {!loading && err && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            <div className="font-medium">Error loading products</div>
            <div className="mt-1">{err}</div>
            <div className="mt-2">Try opening <code>/api/products_audit?limit=1</code> on the API (<code>{process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001'}</code>) to verify connectivity.</div>
          </div>
        )}

        {!loading && !err && total === 0 && (
          <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="font-medium">No products found</div>
            <div className="mt-1">If you haven't imported the sample catalog yet, run:</div>
            <pre className="mt-2 rounded bg-amber-100 p-2 text-xs">npm run ingest\nnpm run import:postgres</pre>
            <div className="mt-2">Then refresh this page. Ensure your <code>.env.local</code> contains <code>POSTGRES_URL</code> and Postgres is running (via <code>docker compose up -d postgres</code>).</div>
          </div>
        )}

        <div className="overflow-auto rounded border border-gray-300">
          <table className="min-w-full table-auto text-left text-xs">
            <thead className="bg-gray-100 text-gray-700 border-b border-gray-300">
              <tr>
                {( [
                  ['id','ID'],['title','Title'],['vendor','Vendor'],['category','Cat'],['price','$'],['available','Av'],['updated','Upd']
                ] as const ).map(([key,label]) => (
                  <th key={key} className="px-2 py-1 cursor-pointer select-none font-semibold" onClick={()=>{
                    const k = key as typeof sortKey;
                    if (sortKey === k) setSortDir(d => d==='asc'?'desc':'asc'); else { setSortKey(k); setSortDir('asc'); }
                  }}>
                    {label}{sortKey===key && (sortDir==='asc'?'↑':'↓')}
                  </th>
                ))}
                <th className="px-2 py-1 font-semibold">Ext</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {loading ? (
                <tr><td colSpan={8} className="px-2 py-4 text-center text-gray-500">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-2 py-4 text-center text-gray-500">No results</td></tr>
              ) : (
                rows.map(r => (
                  <tr key={r.id} onClick={() => window.location.href = `/products/${encodeURIComponent(r.id)}`} className="border-t border-gray-200 hover:bg-blue-50 cursor-pointer">
                    <td className="px-2 py-1 font-mono text-[10px] whitespace-nowrap">{r.id.slice(0,8)}</td>
                    <td className="px-2 py-1 max-w-[400px] truncate" title={r.title}>{r.title}</td>
                    <td className="px-2 py-1 whitespace-nowrap truncate max-w-[120px]" title={r.vendor || ''}>
                      {r.vendor || '—'}
                    </td>
                    <td className="px-2 py-1 truncate max-w-[100px]" title={r.category || ''}>
                      {r.category ? (
                        <span className={`${r.category==='Uncategorized' ? 'text-orange-600 font-semibold' : ''}`}>{r.category}</span>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap text-right">{r.price.toFixed(0)}</td>
                    <td className="px-2 py-1 text-center">{r.available ? '✓' : '✗'}</td>
                    <td className="px-2 py-1 text-[10px] text-gray-500 whitespace-nowrap">{r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : '—'}</td>
                    <td className="px-2 py-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <a href={r.productUrl} target="_blank" rel="noreferrer" className="text-gray-600 hover:underline">Ext↗</a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-2 flex items-center justify-between text-xs">
          <div className="text-gray-600">Pg {page}/{pageCount} · {offset+1}–{Math.min(total, offset + rows.length)} of {total.toLocaleString()}</div>
          <div className="flex items-center gap-1">
            <button disabled={page<=1} onClick={()=>setPage(1)} className="h-7 rounded border border-gray-300 px-2 disabled:opacity-40">«</button>
            <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="h-7 rounded border border-gray-300 px-2 disabled:opacity-40">‹</button>
            <button disabled={page>=pageCount} onClick={()=>setPage(p=>Math.min(pageCount,p+1))} className="h-7 rounded border border-gray-300 px-2 disabled:opacity-40">›</button>
            <button disabled={page>=pageCount} onClick={()=>setPage(pageCount)} className="h-7 rounded border border-gray-300 px-2 disabled:opacity-40">»</button>
          </div>
        </div>
      </div>
    </div>
  );
}
