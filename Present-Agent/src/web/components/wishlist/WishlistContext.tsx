"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type WishItem = {
  id: string;
  title: string;
  price: number;
  currency?: string;
  imageUrl?: string | null;
  productUrl: string;
};

type Ctx = {
  items: WishItem[];
  add: (it: WishItem) => void;
  remove: (id: string) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
  isOpen: boolean;
};

const WishlistCtx = createContext<Ctx | null>(null);

export function useWishlist() {
  const v = useContext(WishlistCtx);
  if (!v) throw new Error("useWishlist outside provider");
  return v;
}

const KEY = "present-agent:wishlist";

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<WishItem[]>([]);
  const [isOpen, setOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
  }, [items]);

  const api = useMemo<Ctx>(() => ({
    items,
    add: (it) => setItems((arr) => (arr.find((x) => x.id === it.id) ? arr : [...arr, it])),
    remove: (id) => setItems((arr) => arr.filter((x) => x.id !== id)),
    clear: () => setItems([]),
    open: () => setOpen(true),
    close: () => setOpen(false),
    isOpen,
  }), [items, isOpen]);

  return (
    <WishlistCtx.Provider value={api}>{children}</WishlistCtx.Provider>
  );
}

