"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3001";

function FacetedProductsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<any[]>([]);
  const [facets, setFacets] = useState<Record<string, Array<{value: string; count: number}>>>({});
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filters from URL
  const [selectedFacets, setSelectedFacets] = useState<Record<string, string[]>>({});
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 24;

  // Load facets on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/facets`)
      .then(res => res.json())
      .then(data => setFacets(data))
      .catch(err => console.error('Failed to load facets:', err));
  }, []);

  // Parse URL params
  useEffect(() => {
    const text = searchParams.get('q') || '';
    const facetParam = searchParams.get('facets') || '';
    const pageParam = parseInt(searchParams.get('page') || '1');

    setSearchText(text);
    setPage(pageParam);

    // Parse facets from URL: occasion:birthday,theme:vintage
    const parsed: Record<string, string[]> = {};
    if (facetParam) {
      facetParam.split(',').forEach(pair => {
        const [key, value] = pair.split(':');
        if (key && value) {
          if (!parsed[key]) parsed[key] = [];
          parsed[key].push(value);
        }
      });
    }
    setSelectedFacets(parsed);
  }, [searchParams]);

  // Fetch products when filters change
  useEffect(() => {
    setLoading(true);
    const facetPairs = Object.entries(selectedFacets).flatMap(([key, values]) =>
      values.map(v => `${key}:${v}`)
    );
    const facetParam = facetPairs.length > 0 ? `&facets=${facetPairs.join(',')}` : '';
    const offset = (page - 1) * pageSize;

    fetch(`${API_BASE}/api/products_audit?limit=${pageSize}&offset=${offset}${searchText ? `&text=${encodeURIComponent(searchText)}` : ''}${facetParam}`)
      .then(res => res.json())
      .then(data => {
        setProducts(data.items || []);
        setTotal(data.total || 0);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load products:', err);
        setLoading(false);
      });
  }, [selectedFacets, searchText, page]);

  function toggleFacet(key: string, value: string) {
    const updated = { ...selectedFacets };
    if (!updated[key]) updated[key] = [];

    if (updated[key].includes(value)) {
      updated[key] = updated[key].filter(v => v !== value);
      if (updated[key].length === 0) delete updated[key];
    } else {
      updated[key].push(value);
    }

    // Update URL
    const facetPairs = Object.entries(updated).flatMap(([k, vals]) => vals.map(v => `${k}:${v}`));
    const params = new URLSearchParams();
    if (searchText) params.set('q', searchText);
    if (facetPairs.length > 0) params.set('facets', facetPairs.join(','));
    params.set('page', '1');
    router.push(`/products/faceted?${params.toString()}`);
  }

  function clearFilters() {
    setSelectedFacets({});
    setSearchText('');
    setPage(1);
    router.push('/products/faceted');
  }

  const activeCount = Object.values(selectedFacets).flat().length;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Curated Gift Search</h1>

        <div className="flex gap-6">
          {/* Sidebar filters */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white rounded-lg shadow p-4 sticky top-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-lg">Filters</h2>
                {activeCount > 0 && (
                  <button onClick={clearFilters} className="text-xs text-blue-600 hover:underline">
                    Clear ({activeCount})
                  </button>
                )}
              </div>

              <input
                type="text"
                placeholder="Search products..."
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className="w-full px-3 py-2 border rounded mb-4 text-sm"
              />

              {/* Render facet groups */}
              {Object.entries(facets).map(([key, values]) => (
                <div key={key} className="mb-4">
                  <h3 className="font-medium text-sm uppercase text-gray-700 mb-2">
                    {key.replace(/_/g, ' ')}
                  </h3>
                  <div className="space-y-1 max-h-48 overflow-y-auto text-sm">
                    {values.slice(0, 15).map(item => {
                      const isSelected = selectedFacets[key]?.includes(item.value) || false;
                      return (
                        <label key={item.value} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleFacet(key, item.value)}
                            className="rounded"
                          />
                          <span className={isSelected ? 'font-medium' : ''}>
                            {item.value.replace(/_/g, ' ')}
                          </span>
                          <span className="text-gray-500 text-xs ml-auto">({item.count})</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Product grid */}
          <div className="flex-1">
            <div className="mb-4 text-sm text-gray-600">
              Found {total} products {activeCount > 0 && `with ${activeCount} filter(s)`}
            </div>

            {loading ? (
              <div className="text-center py-12 text-gray-500">Loading...</div>
            ) : products.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No products found. Try adjusting your filters.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer overflow-hidden"
                    onClick={() => router.push(`/products/${encodeURIComponent(product.id)}`)}
                  >
                    {product.imageUrl && (
                      <div className="aspect-square bg-gray-100 relative">
                        <img
                          src={product.imageUrl}
                          alt={product.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-4">
                      <h3 className="font-medium text-sm mb-1 line-clamp-2">{product.title}</h3>
                      <div className="text-xs text-gray-500 mb-2">{product.vendor}</div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-lg">
                          ${product.price.toFixed(2)}
                        </span>
                        {!product.available && (
                          <span className="text-xs text-red-600">Out of stock</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {total > pageSize && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => {
                    const params = new URLSearchParams(searchParams.toString());
                    params.set('page', String(page - 1));
                    router.push(`/products/faceted?${params.toString()}`);
                  }}
                  className="px-4 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {page} of {Math.ceil(total / pageSize)}
                </span>
                <button
                  disabled={page >= Math.ceil(total / pageSize)}
                  onClick={() => {
                    const params = new URLSearchParams(searchParams.toString());
                    params.set('page', String(page + 1));
                    router.push(`/products/faceted?${params.toString()}`);
                  }}
                  className="px-4 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FacetedProductsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">Loading...</div>}>
      <FacetedProductsContent />
    </Suspense>
  );
}
