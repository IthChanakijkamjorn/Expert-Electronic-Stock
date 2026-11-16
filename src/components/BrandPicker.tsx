"use client";

import { useMemo, useState } from "react";
import { quickCreateProduct } from "@/app/(app)/products/new/quick";

export type PickerProduct = { id: string; name: string; model: string | null; brand: string | null; unit: string };

const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });

// Search box whose results are grouped by brand A-Z, then product A-Z; products without a brand come last.
export function BrandPicker({
  products,
  placeholder,
  emptyText,
  noBrandText,
  available,
  allowOver = false,
  newText,
  onPick,
}: {
  products: PickerProduct[];
  placeholder: string;
  emptyText: string;
  noBrandText: string;
  available?: (id: string) => number;
  allowOver?: boolean;
  newText?: string;
  onPick: (p: PickerProduct) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const typed = query.trim();
  const canCreate = !!newText && !!typed && !products.some((p) => p.name.trim().toLowerCase() === typed.toLowerCase());

  async function create() {
    setBusy(true);
    setFailed(false);
    const p = await quickCreateProduct(typed);
    setBusy(false);
    if (!p) return setFailed(true);
    onPick(p);
    setQuery("");
    setOpen(false);
  }

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? products.filter((p) => `${p.brand ?? ""} ${p.model ?? ""} ${p.name}`.toLowerCase().includes(q))
      : products;
    const byBrand = new Map<string, PickerProduct[]>();
    list.forEach((p) => {
      const key = p.brand?.trim() || "";
      byBrand.set(key, [...(byBrand.get(key) ?? []), p]);
    });
    return [...byBrand.entries()]
      .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : cmp(a, b)))
      .map(([brand, items]) => ({ brand, items: [...items].sort((a, b) => cmp(a.name, b.name)) }));
  }, [products, query]);

  return (
    <div className="relative">
      <input
        className="input"
        placeholder={placeholder}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-lg border border-zinc-300 bg-white shadow-lg">
          {groups.length === 0 && <p className="px-3 py-2 text-muted">{emptyText}</p>}
          {canCreate && (
            <button
              type="button"
              disabled={busy}
              className="w-full border-b border-zinc-200 px-3 py-2 text-left font-semibold text-navy hover:bg-zinc-100"
              onMouseDown={(e) => e.preventDefault()}
              onClick={create}
            >
              + {newText} “{typed}”
            </button>
          )}
          {failed && <p className="px-3 py-2 text-red-600">!</p>}
          {groups.map((g) => (
            <div key={g.brand}>
              <p className="sticky top-0 bg-zinc-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-navy">
                {g.brand || noBrandText}
              </p>
              {g.items.map((p) => {
                const left = available?.(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!allowOver && left !== undefined && left <= 0}
                    className="flex w-full justify-between gap-3 px-3 py-2 text-left hover:bg-zinc-100 disabled:opacity-40"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onPick(p);
                      setQuery("");
                      setOpen(false);
                    }}
                  >
                    <span>{p.model ? `${p.model} · ` : ""}{p.name}</span>
                    {left !== undefined && <span className={`shrink-0 ${left <= 0 ? "text-red-600" : "text-muted"}`}>{left} {p.unit}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
