"use client";

import { useMemo, useState } from "react";
import { quickCreateProduct } from "../products/new/quick";

type Item = { id: string; name: string; model: string | null; brand?: string | null; stock: number; unit: string };

const label = (p: Item) =>
  `${p.brand ? `${p.brand} · ` : ""}${p.model ? `${p.model} · ` : ""}${p.name} (${p.stock} ${p.unit})`;

export function ProductPicker({
  products,
  placeholder,
  emptyText,
  newText,
  onSelect,
}: {
  products: Item[];
  placeholder: string;
  emptyText: string;
  newText?: string;
  onSelect?: (p: Item | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelectedState] = useState<Item | null>(null);
  const setSelected = (p: Item | null) => {
    setSelectedState(p);
    onSelect?.(p);
  };
  const [open, setOpen] = useState(false);
  const [extra, setExtra] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const all = useMemo(() => [...extra, ...products], [extra, products]);
  const typed = query.trim();
  const canCreate = !!newText && !!typed && !all.some((p) => p.name.trim().toLowerCase() === typed.toLowerCase());

  async function create() {
    setBusy(true);
    setFailed(false);
    const p = await quickCreateProduct(typed);
    setBusy(false);
    if (!p) return setFailed(true);
    setExtra((e) => [p, ...e]);
    setSelected(p);
    setOpen(false);
  }

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? all.filter((p) => `${p.brand ?? ""} ${p.model ?? ""} ${p.name}`.toLowerCase().includes(q))
      : all;
    return list.slice(0, 50);
  }, [all, query]);

  return (
    <div className="relative">
      <input type="hidden" name="product_id" value={selected?.id ?? ""} required />
      <input
        className="input mt-1"
        placeholder={placeholder}
        value={selected && !open ? label(selected) : query}
        onFocus={() => {
          setOpen(true);
          setQuery("");
          setSelected(null);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(null);
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoComplete="off"
      />
      {open && (
        <ul className="pop-in absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-[#dcd8e6] bg-white py-1 shadow-[0_18px_40px_rgba(0,0,77,0.14)]">
          {matches.length === 0 && <li className="px-3 py-2 text-muted">{emptyText}</li>}
          {canCreate && (
            <li>
              <button
                type="button"
                disabled={busy}
                className="w-full border-b border-zinc-200 px-3 py-2 text-left font-semibold text-navy hover:bg-zinc-100"
                onMouseDown={(e) => e.preventDefault()}
                onClick={create}
              >
                + {newText} “{typed}”
              </button>
            </li>
          )}
          {failed && <li className="px-3 py-2 text-red-600">!</li>}
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left transition-colors hover:bg-[#f3f2fb]"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setSelected(p);
                  setOpen(false);
                }}
              >
                {label(p)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
