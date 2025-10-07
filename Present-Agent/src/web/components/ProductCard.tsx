"use client";
import Link from "next/link";
import QuickViewDialog from "./QuickViewDialog";
import { ThumbsDown, ThumbsUp, Eye, Heart } from "lucide-react";
import { sendFeedback, trackProductView, trackProductClick } from "../lib/api";
import { useState, useEffect, useRef } from "react";
import { useWishlist } from "./wishlist/WishlistContext";

export default function ProductCard({ p, rationale, isTrending, budgetMin, budgetMax, showValue, isUrgent, matchScore }: {
  p: { id: string; title: string; price: number; currency?: string; imageUrl?: string | null; vendor?: string | null; category?: string | null; productUrl: string };
  rationale?: string;
  isTrending?: boolean;
  budgetMin?: number;
  budgetMax?: number;
  showValue?: boolean;
  isUrgent?: boolean;
  matchScore?: number;
}) {
  const [thanks, setThanks] = useState("");
  const wl = useWishlist();
  const viewTracked = useRef(false);

  // Track view when card becomes visible
  useEffect(() => {
    if (!viewTracked.current) {
      trackProductView(p.id);
      viewTracked.current = true;
    }
  }, [p.id]);

  const handleClick = async () => {
    await trackProductClick(p.id);
  };

  const rate = async (rating: number) => {
    try {
      await sendFeedback({ productId: p.id, rating });
      setThanks(rating > 0 ? "Thanks for the upvote!" : "Got it, we'll tune suggestions.");
      setTimeout(() => setThanks(""), 1500);
    } catch {}
  };

  // Budget status
  const withinBudget = budgetMin !== undefined && budgetMax !== undefined &&
    p.price >= budgetMin && p.price <= budgetMax;
  const nearBudget = budgetMax !== undefined && p.price > budgetMax && p.price <= budgetMax * 1.2;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-gray-200 relative">
      {isTrending && (
        <div className="absolute top-2 right-2 z-10 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg flex items-center gap-1">
          🔥 Trending
        </div>
      )}
      {isUrgent && (
        <div className="absolute top-2 left-2 z-10 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg flex items-center gap-1">
          📦 Fast Ship
        </div>
      )}
      {p.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.imageUrl} alt={p.title} className="h-40 w-full object-cover" />
      ) : (
        <div className="h-40 w-full bg-gray-100" />
      )}
      <div className="p-3">
        <div className="font-semibold mb-1 line-clamp-2">{p.title}</div>
        <div className="text-sm text-gray-500">
          {(() => {
            const parts: string[] = [];
            if (p.vendor) parts.push(String(p.vendor));
            if (p.category && p.category !== 'Uncategorized') parts.push(String(p.category));
            return parts.join(' · ');
          })()}
        </div>

        {/* Enhanced Price Display with Budget Status */}
        <div className="mt-2 flex items-center gap-2">
          <div className="font-semibold text-lg">{(p.currency || "USD")} {p.price.toFixed(2)}</div>
          {withinBudget && (
            <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium">
              ✓ In Budget
            </span>
          )}
          {nearBudget && (
            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-medium">
              Near Budget
            </span>
          )}
        </div>

        {/* Value Indicator */}
        {showValue && withinBudget && (
          <div className="mt-1 text-xs text-green-700 font-medium">
            💰 Great Value
          </div>
        )}

        {/* Match Confidence Score */}
        {matchScore !== undefined && matchScore > 0.7 && (
          <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg p-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-blue-900">
                🎯 {Math.round(matchScore * 100)}% Match
              </span>
            </div>
            <div className="text-xs text-blue-700 mt-1">
              High confidence based on preferences
            </div>
          </div>
        )}

        {/* Social Proof - Simulated for now */}
        {isTrending && (
          <div className="mt-2 flex items-center gap-3 text-xs text-gray-600">
            <span className="flex items-center gap-1">⭐ 4.{Math.floor(Math.random() * 3) + 6}/5</span>
            <span>({Math.floor(Math.random() * 3000) + 500} reviews)</span>
          </div>
        )}

        <div className="mt-3 flex items-center gap-3">
          <Link href={`/products/${encodeURIComponent(p.id)}`} onClick={handleClick} className="text-blue-600 hover:underline">View</Link>
          <QuickViewDialog product={p} trigger={<button onClick={handleClick} className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900"><Eye size={16} /> Quick view</button>} />
          <button onClick={() => wl.add({ id: p.id, title: p.title, price: p.price, currency: p.currency, imageUrl: p.imageUrl, productUrl: p.productUrl })} className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900"><Heart size={16}/> Save</button>
          <button onClick={() => rate(1)} className="ml-auto inline-flex items-center gap-1 text-gray-600 hover:text-gray-900"><ThumbsUp size={16} />
          </button>
          <button onClick={() => rate(-1)} className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900"><ThumbsDown size={16} />
          </button>
        </div>
        {rationale ? <div className="mt-2 text-sm text-gray-600 italic">{rationale}</div> : null}
        {thanks ? <div className="mt-2 text-xs text-green-600">{thanks}</div> : null}
      </div>
    </div>
  );
}
