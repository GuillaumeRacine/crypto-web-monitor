"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { X, Brain, Trash2 } from "lucide-react";
import { getContext, getRecipients, deleteRecipientContext } from "../../lib/api";

export default function MemoryDrawer({ open, onOpenChange, onDelete }: { open: boolean; onOpenChange: (o: boolean) => void; onDelete: () => void }) {
  const [data, setData] = useState<any>(null);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [currentRecipient, setCurrentRecipient] = useState<string | null>(null);
  const [explainDismissed, setExplainDismissed] = useState(false);
  const [edit, setEdit] = useState<{ budgetMin?: string; budgetMax?: string; notes?: string }>({});
  useEffect(() => {
    if (open) {
      getContext().then((j) => setData(j.data)).catch(()=>setData(null));
      getRecipients().then((j) => setRecipients(j.items || [])).catch(()=>setRecipients([]));
    }
  }, [open]);
  const loadRecipient = async (r: string | null) => {
    setCurrentRecipient(r);
    if (r) {
      try { const j = await fetch(`/api/context?recipient=${encodeURIComponent(r)}`, { credentials: 'include' } as any).then(r=>r.json()); setData(j.data); } catch { setData(null); }
    } else {
      try { const j = await getContext(); setData(j.data); } catch { setData(null); }
    }
  };
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content className="fixed right-0 top-0 h-full w-[90vw] max-w-md bg-white shadow-xl">
          <div className="flex items-center justify-between border-b p-4">
            <div className="flex items-center gap-2 font-semibold"><Brain size={16}/> Your memory</div>
            <div className="flex items-center gap-2">
              <button onClick={()=>{ if (confirm('Clear all saved memory? This cannot be undone.')) onDelete(); }} className="text-sm text-gray-600 hover:text-red-600 inline-flex items-center gap-1"><Trash2 size={14}/> Clear</button>
              <Dialog.Close className="rounded-md p-1 hover:bg-gray-100"><X size={16}/></Dialog.Close>
            </div>
          </div>
          <div className="p-4 space-y-3 overflow-y-auto h-[calc(100%-56px)] text-sm">
            {!explainDismissed && (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-blue-900">
                We remember budget, categories, values, and short notes to personalize suggestions. You can clear this anytime.
                <button onClick={()=> setExplainDismissed(true)} className="ml-2 underline">Got it</button>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => loadRecipient(null)} className={`rounded px-2 py-1 border ${currentRecipient ? 'border-gray-200' : 'border-gray-900'}`}>All</button>
              {recipients.map((r) => (
                <button key={r} onClick={() => loadRecipient(r)} className={`rounded px-2 py-1 border ${currentRecipient===r ? 'border-gray-900' : 'border-gray-200'}`}>{r}</button>
              ))}
              {currentRecipient && (
                <button onClick={async()=>{ try { await deleteRecipientContext(currentRecipient); } catch{}; await loadRecipient(null); }} className="text-gray-600 hover:text-red-600 inline-flex items-center gap-1">
                  <Trash2 size={14}/> Clear {currentRecipient}
                </button>
              )}
            </div>
            {!data ? <div className="text-gray-500">No stored context yet.</div> : (
              <div className="space-y-2">
                {data.notes && <div><div className="text-gray-500">Notes</div><div>{data.notes}</div></div>}
                {(data.budgetMin != null || data.budgetMax != null) && (
                  <div><div className="text-gray-500">Budget</div><div>{data.budgetMin ?? '—'} – {data.budgetMax ?? '—'}</div></div>
                )}
                {Array.isArray(data.categories) && data.categories.length > 0 && (
                  <div><div className="text-gray-500">Categories</div><div className="flex flex-wrap gap-2">{data.categories.map((c:string) => <span key={c} className="rounded bg-gray-100 px-2 py-0.5">{c}</span>)}</div></div>
                )}
                {Array.isArray(data.values) && data.values.length > 0 && (
                  <div><div className="text-gray-500">Values</div><div className="flex flex-wrap gap-2">{data.values.map((c:string) => <span key={c} className="rounded bg-gray-100 px-2 py-0.5">{c}</span>)}</div></div>
                )}
                <div className="mt-3">
                  <div className="text-gray-500">Edit memory</div>
                  <div className="mt-1 grid grid-cols-1 gap-2">
                    <div className="flex gap-2">
                      <input className="h-9 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" placeholder="Budget min" value={edit.budgetMin ?? ''} onChange={(e)=> setEdit(s=>({...s, budgetMin: e.target.value}))} />
                      <input className="h-9 w-full rounded-md border border-gray-200 px-3 py-2 text-sm" placeholder="Budget max" value={edit.budgetMax ?? ''} onChange={(e)=> setEdit(s=>({...s, budgetMax: e.target.value}))} />
                    </div>
                    <textarea className="min-h-[80px] w-full rounded-md border border-gray-200 px-3 py-2 text-sm" placeholder="Notes" value={edit.notes ?? ''} onChange={(e)=> setEdit(s=>({...s, notes: e.target.value}))}></textarea>
                    <div>
                      <button onClick={async()=>{
                        const payload:any = {};
                        if (edit.notes) payload.notes = edit.notes;
                        if (edit.budgetMin) payload.budgetMin = Number(edit.budgetMin);
                        if (edit.budgetMax) payload.budgetMax = Number(edit.budgetMax);
                        try {
                          await fetch((process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001') + '/api/context', { method:'POST', headers: { 'Content-Type':'application/json' }, credentials: 'include' as any, body: JSON.stringify(payload) });
                          getContext().then((j) => setData(j.data)).catch(()=>setData(null));
                          setEdit({});
                        } catch {}
                      }} className="inline-flex h-9 items-center rounded-md bg-gray-900 px-3 text-sm text-white">Save</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
