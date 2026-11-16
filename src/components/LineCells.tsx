"use client";

import { useMemo, useState } from "react";
import { blank, type PaperLine } from "./InvoicePaper";

export type PickerProduct = { id: string; name: string; model: string | null; brand: string | null; unit: string };

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

type Option = { id: string; label: string; onPick: () => void };

// Typed cell with a suggestion list; anything not in the list is kept as typed.
function LineField({ value, options, onType }: { value: string; options: Option[]; onType: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [touched, setTouched] = useState(false);
  const q = touched ? value.trim().toLowerCase() : "";
  const shown = (q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options).slice(0, 200);

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
      {open && shown.length > 0 && (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-72 w-[360px] overflow-auto rounded-lg border border-zinc-300 bg-white text-left text-sm font-normal shadow-lg">
          {shown.map((o) => (
            <button
              key={o.id}
              type="button"
              className="block w-full px-3 py-1.5 text-left hover:bg-zinc-100"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                o.onPick();
                setOpen(false);
              }}
            >
              {o.label}
            </button>
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

// Brand -> Model -> Description cells of one row. Picking a model fills in the description, unit and price.
export function LineCells({ l, h, products, td }: { l: PaperLine; h: LineHandlers; products: PickerProduct[]; td: string }) {
  const brands = useMemo(
    () => [...new Set(products.map((p) => p.brand?.trim() ?? "").filter(Boolean))].sort(cmp),
    [products],
  );
  const models = useMemo(() => {
    const b = l.brand.trim().toLowerCase();
    return products
      .filter((p) => (b ? (p.brand ?? "").trim().toLowerCase() === b : true))
      .sort((a, c) => cmp(a.model || a.name, c.model || c.name));
  }, [products, l.brand]);

  const brandOptions: Option[] = brands.map((b) => ({ id: b, label: b, onPick: () => h.onLine(l.key, { brand: b }) }));
  const modelOptions: Option[] = models.map((p) => ({
    id: p.id,
    label: `${l.brand.trim() ? "" : p.brand ? `${p.brand} · ` : ""}${p.model ? `${p.model} — ` : ""}${p.name}`,
    onPick: () => h.onPick?.(l.key, p),
  }));

  const typeModel = (v: string) => {
    h.onLine(l.key, { model: v });
    const b = l.brand.trim().toLowerCase();
    const hit = v.trim() && products.find((p) => (p.model ?? "").toLowerCase() === v.trim().toLowerCase() && (!b || (p.brand ?? "").toLowerCase() === b));
    if (hit) h.onPick?.(l.key, hit);
  };

  return (
    <>
      <td className={td}>
        <LineField value={l.brand} options={brandOptions} onType={(v) => h.onLine(l.key, { brand: v })} />
      </td>
      <td className={td}>
        <LineField value={l.model} options={modelOptions} onType={typeModel} />
      </td>
      <td className={td}>
        <input className={blank} value={l.name} onChange={(e) => h.onLine(l.key, { name: e.target.value })} autoComplete="off" />
        {l.hint && <div className={`text-[11px] ${l.over ? "text-red-600" : "text-zinc-500"}`}>{l.hint}</div>}
      </td>
    </>
  );
}
