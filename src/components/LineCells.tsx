"use client";

import { useMemo, useState } from "react";
import { blank, type PaperLine } from "./InvoicePaper";

export type PickerProduct = { id: string; name: string; sku: string | null; brand: string | null; unit: string };

const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });

export const isBlankLine = (l: PaperLine) => !l.brand.trim() && !l.model.trim() && !l.name.trim();

export const newBlankLine = (): PaperLine => ({
  key: `n${Math.random().toString(36).slice(2)}`,
  brand: "",
  model: "",
  name: "",
  unit: "pcs",
  qty: "",
  price: "",
});

// Keeps exactly one empty row at the end so there is always a place to type the next item.
export const withBlank = (lines: PaperLine[]): PaperLine[] => {
  const kept = lines.filter((l, i) => !isBlankLine(l) || i === lines.length - 1);
  const last = kept[kept.length - 1];
  return last && isBlankLine(last) ? kept : [...kept, newBlankLine()];
};

// Typed cell that suggests saved products grouped by brand (A-Z); anything not in the list is kept as typed.
function LineField({
  value,
  products,
  onType,
  onPick,
  onPickBrand,
}: {
  value: string;
  products: PickerProduct[];
  onType: (v: string) => void;
  onPick: (p: PickerProduct) => void;
  onPickBrand: (brand: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [touched, setTouched] = useState(false);

  const groups = useMemo(() => {
    const q = touched ? value.trim().toLowerCase() : "";
    const list = q ? products.filter((p) => `${p.brand ?? ""} ${p.sku ?? ""} ${p.name}`.toLowerCase().includes(q)) : products;
    const byBrand = new Map<string, PickerProduct[]>();
    list.slice(0, 400).forEach((p) => {
      const k = p.brand?.trim() || "";
      byBrand.set(k, [...(byBrand.get(k) ?? []), p]);
    });
    return [...byBrand.entries()]
      .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : cmp(a, b)))
      .map(([brand, items]) => ({ brand, items: [...items].sort((a, b) => cmp(a.name, b.name)) }));
  }, [products, value, touched]);

  return (
    <div className="relative">
      <input
        className={blank}
        value={value}
        onFocus={() => {
          setTouched(false);
          setOpen(true);
        }}
        onChange={(e) => {
          setTouched(true);
          setOpen(true);
          onType(e.target.value);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoComplete="off"
      />
      {open && groups.length > 0 && (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-72 w-[420px] overflow-auto rounded-lg border border-zinc-300 bg-white text-left text-sm font-normal shadow-lg">
          {groups.map((g) => (
            <div key={g.brand}>
              <button
                type="button"
                disabled={!g.brand}
                className="sticky top-0 block w-full bg-zinc-100 px-3 py-1 text-left text-xs font-semibold uppercase tracking-wider text-navy"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPickBrand(g.brand);
                  setOpen(false);
                }}
              >
                {g.brand || "—"}
              </button>
              {g.items.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="block w-full px-3 py-1.5 text-left hover:bg-zinc-100"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onPick(p);
                    setOpen(false);
                  }}
                >
                  {p.sku ? `${p.sku} · ` : ""}{p.name}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export type LineHandlers = {
  onLine: (key: string, patch: Partial<PaperLine>) => void;
  onPick?: (key: string, p: PickerProduct) => void;
};

// Brand / Model / Description cells of one row: typeable, with product suggestions.
export function LineCells({
  l,
  h,
  products,
  td,
}: {
  l: PaperLine;
  h: LineHandlers;
  products: PickerProduct[];
  td: string;
}) {
  const pick = (p: PickerProduct) => h.onPick?.(l.key, p);
  const brandPick = (brand: string) => h.onLine(l.key, { brand });
  return (
    <>
      <td className={td}>
        <LineField value={l.brand} products={products} onType={(v) => h.onLine(l.key, { brand: v })} onPick={pick} onPickBrand={brandPick} />
      </td>
      <td className={td}>
        <LineField value={l.model} products={products} onType={(v) => h.onLine(l.key, { model: v })} onPick={pick} onPickBrand={brandPick} />
      </td>
      <td className={td}>
        <LineField value={l.name} products={products} onType={(v) => h.onLine(l.key, { name: v })} onPick={pick} onPickBrand={brandPick} />
        {l.hint && <div className={`text-[11px] ${l.over ? "text-red-600" : "text-zinc-500"}`}>{l.hint}</div>}
      </td>
    </>
  );
}
