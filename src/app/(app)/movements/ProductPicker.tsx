"use client";

import { useMemo, useState } from "react";

type Item = { id: string; name: string; sku: string | null; brand?: string | null; stock: number; unit: string };

const label = (p: Item) =>
  `${p.brand ? `${p.brand} · ` : ""}${p.sku ? `${p.sku} · ` : ""}${p.name} (${p.stock} ${p.unit})`;

export function ProductPicker({
  products,
  placeholder,
  emptyText,
}: {
  products: Item[];
  placeholder: string;
  emptyText: string;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Item | null>(null);
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? products.filter((p) => `${p.brand ?? ""} ${p.sku ?? ""} ${p.name}`.toLowerCase().includes(q))
      : products;
    return list.slice(0, 50);
  }, [products, query]);

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
