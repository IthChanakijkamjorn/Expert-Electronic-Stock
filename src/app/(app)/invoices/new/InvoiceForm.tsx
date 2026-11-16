"use client";

import { useActionState, useMemo, useState } from "react";
import { saveInvoice } from "../actions";
import { InvoicePaper, type PaperData, type PaperHandlers, type PaperLine } from "@/components/InvoicePaper";
import { DocVariantSelect } from "@/components/DocVariantSelect";
import { BrandPicker } from "@/components/BrandPicker";
import type { DocCompany } from "@/lib/company";
import { saveCompanyDefault, type Salesperson } from "../../documents/actions";
import { SalesPicker } from "@/components/SalesPicker";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type Product = { id: string; name: string; sku: string | null; brand: string | null; unit: string };

export function InvoiceForm({
  t,
  defaultCompany,
  products,
  stock,
  sellPrice,
  projects,
  locations,
  salesperson,
  salespeople,
  existing,
}: {
  t: Dictionary;
  defaultCompany: DocCompany;
  products: Product[];
  stock: Record<string, Record<string, number>>;
  sellPrice: Record<string, number>;
  projects: { id: string; label: string }[];
  locations: { id: string; name: string; is_default: boolean }[];
  salesperson: string;
  salespeople: Salesperson[];
  existing?: { id: string; status: "draft" | "final"; data: PaperData; projectId: string; locationId: string };
}) {
  const [state, action, pending] = useActionState(saveInvoice.bind(null, existing?.id ?? null), null);
  const [data, setData] = useState<PaperData>(existing?.data ?? {
    number: "IV-____-____",
    company: defaultCompany,
    customerCode: "",
    customer: "",
    address: "",
    taxId: "",
    branch: "",
    salesperson,
    date: new Date().toISOString().slice(0, 10),
    vat: true,
    variant: "original",
    lines: [],
  });
  const [preview, setPreview] = useState(false);
  const [editCompany, setEditCompany] = useState(false);
  const [projectId, setProjectId] = useState(existing?.projectId ?? "");
  const [locationId] = useState(existing?.locationId ?? locations.find((l) => l.is_default)?.id ?? locations[0]?.id ?? "");

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const available = (id: string) => stock[id]?.[locationId] ?? 0;

  const addProduct = (p: Product) => {
    setData((d) => ({
      ...d,
      lines: d.lines.some((l) => l.key === p.id)
        ? d.lines.map((l) => (l.key === p.id ? { ...l, qty: String(Number(l.qty) + 1) } : l))
        : [
            ...d.lines,
            { key: p.id, brand: p.brand ?? "", model: p.sku ?? "", name: p.name, unit: p.unit, qty: "1", price: String(sellPrice[p.id] ?? 0) },
          ],
    }));
  };

  const salesSlot = (
    <SalesPicker initial={salespeople} value={data.salesperson} onChange={(v) => setData((d) => ({ ...d, salesperson: v }))} labels={{ add: t.salesAdd, remove: t.remove, save: t.save, confirm: t.salesRemoveConfirm }} />
  );

  const handlers: PaperHandlers = {
    onField: (patch) => setData((d) => ({ ...d, ...patch })),
    onCompany: (patch) => setData((d) => ({ ...d, company: { ...d.company, ...patch } })),
    onLine: (key, patch) => setData((d) => ({ ...d, lines: d.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) })),
    onRemove: (key) => setData((d) => ({ ...d, lines: d.lines.filter((l) => l.key !== key) })),
  };

  const lines: PaperLine[] = data.lines.map((l) => {
    const left = available(l.key);
    const over = Number(l.qty) > left;
    return { ...l, over, hint: `${over ? `${t.invOverStock} — ` : ""}${t.invAvailable}: ${left} ${byId.get(l.key)?.unit ?? ""}` };
  });
  const invalid =
    !data.customer.trim() || !lines.length || lines.some((l) => !(Math.floor(Number(l.qty)) > 0) || !(Number(l.price) >= 0));

  const addRow = (
    <BrandPicker
      products={products}
      placeholder={`+ ${t.invAddItem}`}
      emptyText={t.noMatches}
      noBrandText={t.invNoBrand} newText={t.addNewProduct}
      available={available}
      allowOver
      onPick={addProduct}
    />
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="customer_code" value={data.customerCode} />
      <input type="hidden" name="customer" value={data.customer} />
      <input type="hidden" name="address" value={data.address} />
      <input type="hidden" name="tax_id" value={data.taxId} />
      <input type="hidden" name="branch" value={data.branch} />
      <input type="hidden" name="salesperson" value={data.salesperson} />
      <input type="hidden" name="invoice_date" value={data.date} />
      <input type="hidden" name="vat" value={data.vat ? "1" : "0"} />
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="location_id" value={locationId} />
      <input type="hidden" name="company" value={JSON.stringify(data.company)} />
      <input
        type="hidden"
        name="lines"
        value={JSON.stringify(data.lines.map((l) => ({ product_id: l.key, qty: Number(l.qty), price: Number(l.price) })))}
      />

      <div className="card flex flex-wrap items-end gap-4 print:hidden">
        {!preview && (
          <>
            {projects.length > 0 && (
              <label className="text-sm">
                {t.projects}
                <select className="input mt-1" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  <option value="">{t.noProject}</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </label>
            )}
            <DocVariantSelect value={data.variant ?? "original"} label={t.docVariant} onChange={(v) => setData((d) => ({ ...d, variant: v }))} />
            <button type="button" className="btn-ghost" onClick={() => {
              if (editCompany) saveCompanyDefault("invoice", data.company);
              setEditCompany((v) => !v);
            }}>
              ✎ {editCompany ? t.docDoneEditing : t.docEditCompany}
            </button>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={data.vat} onChange={(e) => setData((d) => ({ ...d, vat: e.target.checked }))} />
              {t.invIncludeVat}
            </label>
            <button name="intent" value="draft" formNoValidate disabled={pending} className="btn-ghost ml-auto">💾 {t.saveDraft}</button>
            <button type="button" className="btn" disabled={invalid} onClick={() => { setPreview(true); window.scrollTo({ top: 0 }); }}>
              {t.docPreview} →
            </button>
          </>
        )}
        {preview && (
          <>
            <button type="button" className="btn-ghost" onClick={() => setPreview(false)}>← {t.docBackToEdit}</button>
            <button type="button" className="btn-ghost" onClick={() => window.print()}>🖨 {t.docPrint}</button>
            <button name="intent" value="draft" disabled={pending} className="btn-ghost ml-auto">💾 {t.saveDraft}</button>
            <button name="intent" value="final" disabled={pending} className="btn">{t.invCreate}</button>
          </>
        )}
        <p className="w-full text-sm text-muted">{preview ? t.docPreviewNote : t.invStockNote}</p>
        {existing?.status === "final" && <p className="w-full text-sm text-amber-700">{t.invEditNote}</p>}
        {state?.error && (
          <p className="w-full text-red-600">{state.error === "insufficient" ? t.insufficientStock : t.saveFailed}</p>
        )}
      </div>

      <div className="overflow-x-auto pb-4">
        <InvoicePaper
          data={{ ...data, lines }}
          h={preview ? undefined : handlers}
          salesSlot={salesSlot}
          editCompany={editCompany && !preview}
          addRow={preview ? undefined : addRow}
        />
      </div>
    </form>
  );
}
