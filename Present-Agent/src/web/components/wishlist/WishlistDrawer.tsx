"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Heart, Trash2 } from "lucide-react";
import { useWishlist } from "./WishlistContext";
import Link from "next/link";

export default function WishlistDrawer() {
  const wl = useWishlist();
  return (
    <Dialog.Root open={wl.isOpen} onOpenChange={(o) => (o ? wl.open() : wl.close())}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content className="fixed right-0 top-0 h-full w-[90vw] max-w-md bg-white shadow-xl">
          <div className="flex items-center justify-between border-b p-4">
            <div className="flex items-center gap-2 font-semibold"><Heart size={16}/> Wishlist</div>
            <div className="flex items-center gap-2">
              {wl.items.length > 0 && (
                <button onClick={wl.clear} className="text-sm text-gray-600 hover:text-red-600 inline-flex items-center gap-1"><Trash2 size={14}/> Clear</button>
              )}
              <Dialog.Close className="rounded-md p-1 hover:bg-gray-100"><X size={16}/></Dialog.Close>
            </div>
          </div>
          <div className="p-4 space-y-3 overflow-y-auto h-[calc(100%-56px)]">
            {wl.items.length === 0 ? (
              <div className="text-sm text-gray-500">No saved items yet. Click “Save” on a product to add it.</div>
            ) : wl.items.map((it) => (
              <div key={it.id} className="flex gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {it.imageUrl ? <img src={it.imageUrl} alt={it.title} className="h-16 w-16 rounded-md object-cover"/> : <div className="h-16 w-16 rounded-md bg-gray-100"/>}
                <div className="min-w-0 flex-1">
                  <div className="font-medium line-clamp-2">{it.title}</div>
                  <div className="text-sm text-gray-500">{(it.currency||'USD')} {it.price.toFixed(2)}</div>
                  <div className="mt-1 flex gap-3 text-sm">
                    <a href={it.productUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">View</a>
                    <button onClick={() => wl.remove(it.id)} className="text-gray-600 hover:text-red-600">Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

