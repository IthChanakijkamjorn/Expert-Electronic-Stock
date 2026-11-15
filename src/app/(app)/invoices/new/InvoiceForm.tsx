"use client";

import { useActionState, useMemo, useState } from "react";
import { createInvoice } from "../actions";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type Product = { id: string; name: string; sku: string | null; brand: string | null; unit: string };
type Line = { product: Product; qty: string; price: string };

const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });

export function InvoiceForm({
  t,
  products,
  stock,
  sellPrice,
  projects,
  locations,
  salesperson,
}: {
  t: Dictionary;
  products: Product[];
  stock: Record<string, Record<string, number>>;
  sellPrice: Record<string, number>;
  projects: { id: string; label: string }[];
  locations: { id: string; name: string; is_default: boolean }[];
  salesperson: string;
}) {
  const [state, action, pending] = useActionState(createInvoice, null);
  const [lines, setLines] = useState<Line[]>([]);
  const [vat, setVat] = useState(true);
  const [locationId, setLocationId] = useState(locations.find((l) => l.is_default)?.id ?? locations[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const available = (id: string) => stock[id]?.[locationId] ?? 0;

  // Brands A-Z first, products A-Z inside each brand; products without a brand come last.
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? products.filter((p) => `${p.brand ?? ""} ${p.sku ?? ""} ${p.name}`.toLowerCase().includes(q))
      : products;
    const byBrand = new Map<string, Product[]>();
    list.forEach((p) => {
      const key = p.brand?.trim() || "";
      byBrand.set(key, [...(byBrand.get(key) ?? []), p]);
    });
    return [...byBrand.entries()]
      .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : cmp(a, b)))
      .map(([brand, items]) => ({ brand, items: items.sort((a, b) => cmp(a.name, b.name)) }));
  }, [products, query]);

  const addProduct = (p: Product) => {
    setLines((cur) =>
      cur.some((l) => l.product.id === p.id)
        ? cur.map((l) => (l.product.id === p.id ? { ...l, qty: String(Number(l.qty) + 1) } : l))
        : [...cur, { product: p, qty: "1", price: String(sellPrice[p.id] ?? 0) }],
    );
    setQuery("");
    setOpen(false);
  };
  const patch = (id: string, v: Partial<Line>) =>
    setLines((cur) => cur.map((l) => (l.product.id === id ? { ...l, ...v } : l)));

  const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const subtotal = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
  const vatAmount = vat ? subtotal * 0.07 : 0;
  const over = lines.some((l) => Number(l.qty) > available(l.product.id));
  const invalid = !lines.length || lines.some((l) => !(Math.floor(Number(l.qty)) > 0) || !(Number(l.price) >= 0));

  const field = "input mt-1";
  return (
    <form action={action} className="flex flex-col gap-6">
      <div className="card grid gap-3 md:grid-cols-2">
        <label>
          {t.invCustomerCode}
          <input name="customer_code" className={field} />
        </label>
        <label>
          {t.invDate}
          <input name="invoice_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className={field} />
        </label>
        <label className="md:col-span-2">
          {t.invCustomer}
          <input name="customer" required className={field} />
        </label>
        <label className="md:col-span-2">
          {t.invAddress}
          <textarea name="address" rows={2} className={field} />
        </label>
        <label>
          {t.invTaxId}
          <input name="tax_id" className={field} />
        </label>
        <label>
          {t.invBranch}
          <input name="branch" className={field} />
        </label>
        <label>
          {t.invSalesperson}
          <input name="salesperson" defaultValue={salesperson} className={field} />
        </label>
        {projects.length > 0 && (
          <label>
            {t.projects}
            <select name="project_id" className={field} defaultValue="">
              <option value="">{t.noProject}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </label>
        )}
        {locations.length > 1 ? (
          <label>
            {t.location}
            <select name="location_id" className={field} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="location_id" value={locationId} />
        )}
      </div>

      <div className="card flex flex-col gap-3">
        <div className="relative">
          <span>{t.invAddItem}</span>
          <input
            className="input mt-1"
            placeholder={t.searchProducts}
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
              {groups.length === 0 && <p className="px-3 py-2 text-muted">{t.noMatches}</p>}
              {groups.map((g) => (
                <div key={g.brand}>
                  <p className="sticky top-0 bg-zinc-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-navy">
                    {g.brand || t.invNoBrand}
                  </p>
                  {g.items.map((p) => {
                    const left = available(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={left <= 0}
                        className="flex w-full justify-between gap-3 px-3 py-2 text-left hover:bg-zinc-100 disabled:opacity-40"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => addProduct(p)}
                      >
                        <span>{p.sku ? `${p.sku} · ` : ""}{p.name}</span>
                        <span className="shrink-0 text-muted">{left} {p.unit}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {lines.length ? (
          <div className="overflow-x-auto">
            <table className="data-table w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="py-2 pr-3">{t.invBrand}</th>
                  <th className="pr-3">{t.invDescription}</th>
                  <th className="pr-3">{t.quantity}</th>
                  <th className="pr-3">{t.invUnitPrice}</th>
                  <th className="pr-3 text-right">{t.invAmount}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const tooMany = Number(l.qty) > available(l.product.id);
                  return (
                    <tr key={l.product.id} className="border-t border-zinc-100 align-top">
                      <td className="py-2 pr-3">{l.product.brand}</td>
                      <td className="pr-3">
                        {l.product.sku && <span className="text-muted">{l.product.sku} · </span>}
                        {l.product.name}
                        <div className={tooMany ? "text-xs text-red-600" : "text-xs text-muted"}>
                          {tooMany ? `${t.invOverStock} — ` : ""}{t.invAvailable}: {available(l.product.id)} {l.product.unit}
                        </div>
                      </td>
                      <td className="pr-3">
                        <input type="number" min={1} step={1} className="input w-24" value={l.qty} onChange={(e) => patch(l.product.id, { qty: e.target.value })} />
                      </td>
                      <td className="pr-3">
                        <input type="number" min={0} step="0.01" className="input w-32" value={l.price} onChange={(e) => patch(l.product.id, { price: e.target.value })} />
                      </td>
                      <td className="pr-3 text-right">{money((Number(l.qty) || 0) * (Number(l.price) || 0))}</td>
                      <td>
                        <button type="button" className="btn-ghost" onClick={() => setLines((cur) => cur.filter((x) => x.product.id !== l.product.id))}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted">{t.invNoLines}</p>
        )}

        <div className="ml-auto flex w-full max-w-xs flex-col gap-1 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={vat} onChange={(e) => setVat(e.target.checked)} />
            {t.invIncludeVat}
          </label>
          <input type="hidden" name="vat" value={vat ? "1" : "0"} />
          <p className="flex justify-between"><span>{t.invSubtotal}</span><span>{money(subtotal)}</span></p>
          <p className="flex justify-between"><span>{t.invVat}</span><span>{vat ? money(vatAmount) : "-"}</span></p>
          <p className="flex justify-between font-semibold"><span>{t.invGrandTotal}</span><span>{money(subtotal + vatAmount)}</span></p>
        </div>
      </div>

      <input
        type="hidden"
        name="lines"
        value={JSON.stringify(lines.map((l) => ({ product_id: l.product.id, qty: Number(l.qty), price: Number(l.price) })))}
      />
      <p className="text-sm text-muted">{t.invStockNote}</p>
      {state?.error && (
        <p className="text-red-600">{state.error === "insufficient" ? t.insufficientStock : t.saveFailed}</p>
      )}
      <button disabled={pending || invalid || over} className="btn w-fit">{t.invCreate}</button>
    </form>
  );
}
