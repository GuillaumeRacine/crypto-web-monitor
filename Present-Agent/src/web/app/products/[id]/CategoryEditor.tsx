"use client";
import { useState } from "react";
import { setProductCategory } from "../../../lib/api";

export default function CategoryEditor({ productId, currentPrimary }: { productId: string; currentPrimary?: string }) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const save = async (mode: 'primary'|'additional') => {
    const name = value.trim();
    if (!name) return;
    setSaving(true);
    setMsg(null);
    try {
      await setProductCategory(productId, name, mode);
      setMsg(`Category ${mode === 'primary' ? 'set' : 'added'}: ${name}`);
      setValue("");
    } catch (e: any) {
      setMsg(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
      setTimeout(()=>setMsg(null), 2000);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e)=>setValue(e.target.value)}
        placeholder={currentPrimary ? `Change from ${currentPrimary}…` : 'Set category…'}
        className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
        aria-label="Category name"
      />
      <button
        type="button"
        onClick={()=>save('primary')}
        disabled={saving || !value.trim()}
        className="rounded-md bg-gray-900 text-white px-2 py-1 text-sm disabled:opacity-50"
      >
        Set Primary
      </button>
      <button
        type="button"
        onClick={()=>save('additional')}
        disabled={saving || !value.trim()}
        className="rounded-md border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
      >
        Add Additional
      </button>
      {msg && <span className="text-xs text-gray-600">{msg}</span>}
    </div>
  );
}

