"use client";

import { useMemo, useState } from "react";
import { quickCreateProduct } from "../products/new/quick";

type Item = { id: string; name: string; sku: string | null; brand?: string | null; stock: number; unit: string };

const label = (p: Item) =>
  `${p.brand ? `${p.brand} · ` : ""}${p.sku ? `${p.sku} · ` : ""}${p.name} (${p.stock} ${p.unit})`;

export function ProductPicker({
  products,
  placeholder,
  emptyText,
  newText,
}: {
  products: Item[];
  placeholder: string;
  emptyText: string;
  newText?: string;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Item | null>(null);
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
      ? all.filter((p) => `${p.brand ?? ""} ${p.sku ?? ""} ${p.name}`.toLowerCase().includes(q))
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
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-zinc-300 bg-white shadow-lg">
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
                className="w-full px-3 py-2 text-left hover:bg-zinc-100"
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
