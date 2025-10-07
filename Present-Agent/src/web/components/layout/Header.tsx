"use client";
import Link from "next/link";
import { ShoppingBag, MessageCircle, Heart, Brain } from "lucide-react";
import { useWishlist } from "../wishlist/WishlistContext";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { me, logout, deleteContext } from "../../lib/api";
import MemoryDrawer from "../memory/MemoryDrawer";
import WishlistDrawer from "../wishlist/WishlistDrawer";

export default function Header() {
  const wl = useWishlist();
  const [user, setUser] = useState<any>(null);
  const [memOpen, setMemOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => { me().then((j) => setUser(j.user)).catch(() => {}); }, []);
  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <ShoppingBag size={18} /> Present Agent
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/" className={`flex items-center gap-1 ${pathname === '/' ? 'text-gray-900 font-medium' : 'text-gray-700 hover:text-gray-900'}`}><MessageCircle size={16}/> Gift Finder</Link>
          <Link href="/products/faceted" className={`${pathname?.startsWith('/products/faceted') ? 'text-gray-900 font-medium' : 'text-gray-700 hover:text-gray-900'}`}>Browse Gifts</Link>
          <button onClick={wl.open} className={`relative inline-flex items-center gap-1 ${wl.items.length ? 'text-gray-900' : 'text-gray-700 hover:text-gray-900'}`}>
            <Heart size={16}/> Saved
            {wl.items.length > 0 && (
              <span className="absolute -right-3 -top-2 rounded-full bg-red-500 px-1.5 text-[10px] leading-5 text-white">{wl.items.length}</span>
            )}
          </button>
          {user ? (
            <span className="text-gray-600">{user.email} <button className="text-blue-600 hover:underline ml-1" onClick={async()=>{await logout(); setUser(null);}}>Sign out</button></span>
          ) : (
            <Link href="/auth" className="text-blue-600 hover:underline">Sign in</Link>
          )}
        </nav>
      </div>
      <WishlistDrawer />
      <MemoryDrawer open={memOpen} onOpenChange={setMemOpen} onDelete={async()=>{ try { await deleteContext(); } catch{}; setMemOpen(false); }} />
    </header>
  );
}
