"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

export default function QuickViewDialog({ trigger, product }: { trigger: React.ReactNode; product: any }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-[90vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-0 shadow-xl focus:outline-none">
          <div className="flex items-center justify-between border-b border-gray-200 p-4">
            <Dialog.Title className="text-lg font-semibold">{product.title}</Dialog.Title>
            <Dialog.Close className="rounded-md p-1 hover:bg-gray-100">
              <X size={16} />
            </Dialog.Close>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.title} className="w-full rounded-lg" />
            ) : (
              <div className="h-64 bg-gray-100 rounded-lg" />
            )}
            <div>
              <div className="text-gray-500">
                {product.vendor ? `${product.vendor} · ` : ""}
                {product.category || "Uncategorized"}
              </div>
              <div className="mt-2 text-xl font-bold">{(product.currency || "USD")} {Number(product.price).toFixed(2)}</div>
              {product.description ? <p className="mt-3 text-sm leading-relaxed">{product.description}</p> : null}
              <div className="mt-4">
                <a href={product.productUrl} target="_blank" rel="noreferrer" className="inline-block bg-gray-900 text-white px-4 py-2 rounded-md">View on site</a>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

