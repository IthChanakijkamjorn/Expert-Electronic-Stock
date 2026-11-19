"use client";

import { useActionState, useState } from "react";
import { saveQuotation } from "../actions";
import { QuotationPaper, type QuotePaperData, type QuoteHandlers } from "@/components/QuotationPaper";
import { withBlank, isBlankLine } from "@/components/LineCells";
import type { DocCompany } from "@/lib/company";
import { saveCompanyDefault, addCustomer, renameCustomer, deleteCustomer, type Salesperson } from "../../documents/actions";
import { UnitManager } from "@/components/UnitManager";
import { SalesPicker } from "@/components/SalesPicker";
import type { PaperLine } from "@/components/InvoicePaper";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type Product = { id: string; name: string; model: string | null; brand: string | null; unit: string };

export function QuotationForm({
  t,
  defaultCompany,
  products,
  sellPrice,
  projects,
  signatures,
  initialProject,
  initialLines,
  customer,
  quotedBy,
  salespeople,
  customers,
  units: initialUnits,
  existing,
}: {
  t: Dictionary;
  defaultCompany: DocCompany;
  products: Product[];
  sellPrice: Record<string, number>;
  projects: { id: string; label: string; name: string }[];
  signatures: { id: string; name: string; url: string | null; is_default: boolean }[];
  initialProject: string;
  initialLines: { id: string; qty: number }[];
  customer: string;
  quotedBy: string;
  salespeople: Salesperson[];
  customers: Salesperson[];
  units: Salesperson[];
  existing?: { id: string; data: QuotePaperData; projectId: string; sigId: string; dropped: number; final?: boolean };
}) {
  const [state, action, pending] = useActionState(saveQuotation.bind(null, existing?.id ?? null), null);
  const byId = new Map(products.map((p) => [p.id, p]));
  const toLine = (p: Product, qty: number): PaperLine => ({
    key: p.id, productId: p.id, brand: p.brand ?? "", model: p.model ?? "", name: p.name, unit: p.unit, qty: String(qty), price: String(sellPrice[p.id] ?? 0),
  });
  const [sigId, setSigId] = useState(existing?.sigId ?? signatures.find((s) => s.is_default)?.id ?? "");
  const [projectId, setProjectId] = useState(existing?.projectId ?? initialProject);
  const [data, setData] = useState<QuotePaperData>(existing ? { ...existing.data, lines: withBlank(existing.data.lines) } : {
    number: "QT-____-____",
    company: defaultCompany,
    customer,
    attention: "",
    project: projects.find((p) => p.id === initialProject)?.name ?? "",
    phone: "",
    email: "",
    date: new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" }),
    validDays: "30",
    leadDays: "90",
    warrantyYears: "1",
    quotedBy,
    paymentTerms: "เงินสด",
    discountPct: "0",
    vat: true,
    signatureUrl: signatures.find((s) => s.is_default)?.url ?? null,
    lines: withBlank(initialLines.flatMap((l) => (byId.get(l.id) ? [toLine(byId.get(l.id)!, l.qty)] : []))),
  });
  const [units, setUnits] = useState(initialUnits);
  const [preview, setPreview] = useState(false);
  const [editCompany, setEditCompany] = useState(false);

  const setLines = (fn: (l: PaperLine[]) => PaperLine[]) => setData((d) => ({ ...d, lines: withBlank(fn(d.lines)) }));

  const h: QuoteHandlers = {
    onField: (patch) => setData((d) => ({ ...d, ...patch })),
    onCompany: (patch) => setData((d) => ({ ...d, company: { ...d.company, ...patch } })),
    onLine: (key, patch) =>
      setLines((ls) =>
        ls.map((l) => (l.key === key ? { ...l, ...patch, ...("brand" in patch || "model" in patch || "name" in patch ? { productId: undefined } : {}) } : l)),
      ),
    onRemove: (key) => setLines((ls) => ls.filter((l) => l.key !== key)),
    onMove: (from, to) =>
      setLines((ls) => {
        const a = ls.findIndex((l) => l.key === from);
        const b = ls.findIndex((l) => l.key === to);
        if (a < 0 || b < 0) return ls;
        const next = [...ls];
        const [m] = next.splice(a, 1);
        next.splice(b, 0, m);
        return next;
      }),
    onPick: (key, p) =>
      setLines((ls) =>
        ls.map((l) =>
          l.key === key
            ? { ...l, productId: p.id, brand: p.brand ?? "", model: p.model ?? "", name: p.name, unit: /^pcs?$/i.test(p.unit) ? "ชิ้น" : p.unit, qty: l.qty || "1", price: String(sellPrice[p.id] ?? 0) }
            : l,
        ),
      ),
  };
  const filled = data.lines.filter((l) => !isBlankLine(l));
  const invalid =
    !data.customer.trim() || !filled.length || filled.some((l) => !l.name.trim() || !(Math.floor(Number(l.qty)) > 0) || !(Number(l.price) >= 0));

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
      <input type="hidden" name="lines" value={JSON.stringify(filled.map((l) => ({ product_id: l.productId ?? null, brand: l.brand, model: l.model, name: l.name, unit: l.unit, qty: Number(l.qty), price: Number(l.price) })))} />

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
            <UnitManager units={units} setUnits={setUnits} label={t.unitManage} onRenamed={(from, to) => setData((d) => ({ ...d, lines: d.lines.map((l) => (l.unit === from ? { ...l, unit: to } : l)) }))} />
            <button type="button" className="btn-ghost" onClick={() => {
              if (editCompany) saveCompanyDefault("quote", data.company);
              setEditCompany((v) => !v);
            }}>
              ✎ {editCompany ? t.docDoneEditing : t.docEditCompany}
            </button>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={data.vat} onChange={(e) => setData((d) => ({ ...d, vat: e.target.checked }))} />
              {t.includeVat}
            </label>
            {existing?.final ? (
              <button name="intent" value="final" disabled={pending || invalid} className="btn-ghost ml-auto">💾 {t.save}</button>
            ) : (
              <button name="intent" value="draft" formNoValidate disabled={pending} className="btn-ghost ml-auto">💾 {t.saveDraft}</button>
            )}
            <button type="button" className="btn" disabled={invalid} onClick={() => { setPreview(true); window.scrollTo({ top: 0 }); }}>
              {t.docPreview} →
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn-ghost" onClick={() => setPreview(false)}>← {t.docBackToEdit}</button>
            {!existing?.final && <button name="intent" value="draft" disabled={pending} className="btn-ghost ml-auto">💾 {t.saveDraft}</button>}
            <button name="intent" value="final" disabled={pending} className={existing?.final ? "btn ml-auto" : "btn"}>{existing?.final ? t.save : t.createQuotation}</button>
          </>
        )}
        <p className="w-full text-sm text-muted">{preview ? t.docPreviewNote : t.quotationHelp}</p>
        {!!existing?.dropped && <p className="w-full text-sm text-amber-700">{t.docDroppedLines.replace("{n}", String(existing.dropped))}</p>}
        {state?.error && <p className="w-full text-red-600">{t.saveFailed}</p>}
      </div>

      <div className="overflow-x-auto pb-4">
        <QuotationPaper
          data={preview ? { ...data, lines: filled } : data}
          h={preview ? undefined : h}
          salesSlot={<SalesPicker initial={salespeople} value={data.quotedBy} onChange={(v) => setData((d) => ({ ...d, quotedBy: v }))} labels={{ add: t.salesAdd, remove: t.remove, save: t.save, confirm: t.salesRemoveConfirm }} />}
          customerSlot={<SalesPicker api={{ add: addCustomer, rename: renameCustomer, remove: deleteCustomer }} initial={customers} value={data.customer} onChange={(v) => setData((d) => ({ ...d, customer: v }))} labels={{ add: t.salesAdd, remove: t.remove, save: t.save, confirm: t.salesRemoveConfirm }} />}
          units={units.map((u) => u.name)}
          paymentOptions={["เงินสด", "ตามเงื่อนไขราชการ"]}
          editCompany={editCompany && !preview}
          pickProducts={products}
        />
      </div>
    </form>
  );
}
