"use client";

import { useActionState, useState } from "react";
import { createQuotation } from "../actions";
import { QuotationPaper, type QuotePaperData, type QuoteHandlers } from "@/components/QuotationPaper";
import { DocVariantSelect } from "@/components/DocVariantSelect";
import { BrandPicker } from "@/components/BrandPicker";
import { defaultDocCompany } from "@/lib/company";
import type { PaperLine } from "@/components/InvoicePaper";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type Product = { id: string; name: string; sku: string | null; brand: string | null; unit: string };

export function QuotationForm({
  t,
  products,
  sellPrice,
  projects,
  signatures,
  initialProject,
  initialLines,
  customer,
  quotedBy,
}: {
  t: Dictionary;
  products: Product[];
  sellPrice: Record<string, number>;
  projects: { id: string; label: string; name: string }[];
  signatures: { id: string; name: string; url: string | null; is_default: boolean }[];
  initialProject: string;
  initialLines: { id: string; qty: number }[];
  customer: string;
  quotedBy: string;
}) {
  const [state, action, pending] = useActionState(createQuotation, null);
  const byId = new Map(products.map((p) => [p.id, p]));
  const toLine = (p: Product, qty: number): PaperLine => ({
    key: p.id, brand: p.brand ?? "", model: p.sku ?? "", name: p.name, unit: p.unit, qty: String(qty), price: String(sellPrice[p.id] ?? 0),
  });
  const [sigId, setSigId] = useState(signatures.find((s) => s.is_default)?.id ?? "");
  const [projectId, setProjectId] = useState(initialProject);
  const [data, setData] = useState<QuotePaperData>({
    number: "QT-____-____",
    company: defaultDocCompany("quote"),
    customer,
    attention: "",
    project: projects.find((p) => p.id === initialProject)?.name ?? "",
    phone: "",
    email: "",
    date: new Date().toISOString().slice(0, 10),
    validDays: "30",
    leadDays: "",
    warrantyYears: "",
    quotedBy,
    paymentTerms: "เงินสด",
    discountPct: "0",
    vat: true,
    variant: "original",
    signatureUrl: signatures.find((s) => s.is_default)?.url ?? null,
    lines: initialLines.flatMap((l) => (byId.get(l.id) ? [toLine(byId.get(l.id)!, l.qty)] : [])),
  });
  const [preview, setPreview] = useState(false);
  const [editCompany, setEditCompany] = useState(false);

  const addProduct = (p: Product) =>
    setData((d) => ({
      ...d,
      lines: d.lines.some((l) => l.key === p.id)
        ? d.lines.map((l) => (l.key === p.id ? { ...l, qty: String(Number(l.qty) + 1) } : l))
        : [...d.lines, toLine(p, 1)],
    }));

  const h: QuoteHandlers = {
    onField: (patch) => setData((d) => ({ ...d, ...patch })),
    onCompany: (patch) => setData((d) => ({ ...d, company: { ...d.company, ...patch } })),
    onLine: (key, patch) => setData((d) => ({ ...d, lines: d.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) })),
    onRemove: (key) => setData((d) => ({ ...d, lines: d.lines.filter((l) => l.key !== key) })),
  };
  const invalid =
    !data.customer.trim() || !data.lines.length || data.lines.some((l) => !(Math.floor(Number(l.qty)) > 0) || !(Number(l.price) >= 0));

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="customer" value={data.customer} />
      <input type="hidden" name="attention" value={data.attention} />
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="project_label" value={data.project} />
      <input type="hidden" name="phone" value={data.phone} />
      <input type="hidden" name="email" value={data.email} />
      <input type="hidden" name="quote_date" value={data.date} />
      <input type="hidden" name="valid_days" value={data.validDays} />
      <input type="hidden" name="lead_days" value={data.leadDays} />
      <input type="hidden" name="warranty_years" value={data.warrantyYears} />
      <input type="hidden" name="quoted_by" value={data.quotedBy} />
      <input type="hidden" name="payment_terms" value={data.paymentTerms} />
      <input type="hidden" name="discount_pct" value={data.discountPct} />
      <input type="hidden" name="vat" value={data.vat ? "1" : "0"} />
      <input type="hidden" name="signature_id" value={sigId} />
      <input type="hidden" name="company" value={JSON.stringify(data.company)} />
      <input type="hidden" name="lines" value={JSON.stringify(data.lines.map((l) => ({ product_id: l.key, qty: Number(l.qty), price: Number(l.price) })))} />

      <div className="card flex flex-wrap items-end gap-4 print:hidden">
        {!preview ? (
          <>
            <label className="text-sm">
              {t.projects}
              <select
                className="input mt-1"
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  const p = projects.find((x) => x.id === e.target.value);
                  if (p) setData((d) => ({ ...d, project: p.name }));
                }}
              >
                <option value="">{t.noProject}</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </label>
            <label className="text-sm">
              {t.qSignature}
              <select
                className="input mt-1"
                value={sigId}
                onChange={(e) => {
                  setSigId(e.target.value);
                  setData((d) => ({ ...d, signatureUrl: signatures.find((s) => s.id === e.target.value)?.url ?? null }));
                }}
              >
                <option value="">{t.noSignatureOption}</option>
                {signatures.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={data.vat} onChange={(e) => setData((d) => ({ ...d, vat: e.target.checked }))} />
              {t.includeVat}
            </label>
            <button type="button" className="btn-ghost" onClick={() => setEditCompany((v) => !v)}>
              ✎ {editCompany ? t.docDoneEditing : t.docEditCompany}
            </button>
            <DocVariantSelect value={data.variant ?? "original"} label={t.docVariant} onChange={(v) => setData((d) => ({ ...d, variant: v }))} />
            <button type="button" className="btn ml-auto" disabled={invalid} onClick={() => { setPreview(true); window.scrollTo({ top: 0 }); }}>
              {t.docPreview} →
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn-ghost" onClick={() => setPreview(false)}>← {t.docBackToEdit}</button>
            <button type="button" className="btn-ghost" onClick={() => window.print()}>🖨 {t.docPrint}</button>
            <button disabled={pending} className="btn ml-auto">{t.createQuotation}</button>
          </>
        )}
        <p className="w-full text-sm text-muted">{preview ? t.docPreviewNote : t.quotationHelp}</p>
        {state?.error && <p className="w-full text-red-600">{t.saveFailed}</p>}
      </div>

      <div className="overflow-x-auto pb-4">
        <QuotationPaper
          data={data}
          h={preview ? undefined : h}
          editCompany={editCompany && !preview}
          addRow={preview ? undefined : (
            <BrandPicker products={products} placeholder={`+ ${t.invAddItem}`} emptyText={t.noMatches} noBrandText={t.invNoBrand} onPick={addProduct} />
          )}
        />
      </div>
    </form>
  );
}
