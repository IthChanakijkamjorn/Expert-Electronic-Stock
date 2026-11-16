"use client";

import { useActionState, useState } from "react";
import { saveReceipt } from "../actions";
import { ReceiptPaper, type ReceiptHandlers, type ReceiptPaperData } from "@/components/ReceiptPaper";
import { DocVariantSelect } from "@/components/DocVariantSelect";
import type { DocCompany } from "@/lib/company";
import { saveCompanyDefault, type Salesperson } from "../../documents/actions";
import { SalesPicker } from "@/components/SalesPicker";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type InvoiceOption = { id: string; number: string; customerCode: string; customer: string; total: number };

export function ReceiptForm({
  t,
  defaultCompany,
  invoices,
  salesperson,
  salespeople,
  existingId,
  existing,
}: {
  t: Dictionary;
  defaultCompany: DocCompany;
  invoices: InvoiceOption[];
  salesperson: string;
  salespeople: Salesperson[];
  existingId?: string;
  existing?: ReceiptPaperData;
}) {
  const [state, action, pending] = useActionState(saveReceipt.bind(null, existingId ?? null), null);
  const [data, setData] = useState<ReceiptPaperData>(existing ?? {
    number: "RC-____-____",
    company: defaultCompany,
    variant: "original",
    customerCode: "",
    customer: "",
    receivedFrom: "",
    salesperson,
    date: new Date().toISOString().slice(0, 10),
    lines: [{ key: "r0", desc: "", qty: "", amount: "" }],
    cashAmount: "",
    chequeBank: "",
    chequeBranch: "",
    chequeNo: "",
    chequeDate: "",
    chequeAmount: "",
  });
  const [preview, setPreview] = useState(false);
  const [editCompany, setEditCompany] = useState(false);

  const h: ReceiptHandlers = {
    onField: (patch) => setData((d) => ({ ...d, ...patch })),
    onCompany: (patch) => setData((d) => ({ ...d, company: { ...d.company, ...patch } })),
    onLine: (key, patch) => setData((d) => ({ ...d, lines: d.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) })),
    onRemove: (key) => setData((d) => ({ ...d, lines: d.lines.filter((l) => l.key !== key) })),
  };

  const importInvoice = (id: string) => {
    const inv = invoices.find((i) => i.id === id);
    if (!inv) return;
    setData((d) => ({
      ...d,
      customerCode: inv.customerCode,
      customer: inv.customer,
      receivedFrom: d.receivedFrom || inv.customer,
      lines: [{ key: inv.id, desc: `ชำระค่าสินค้าตามใบกำกับภาษี ${inv.number}`, qty: "1", amount: inv.total.toFixed(2) }],
      cashAmount: d.cashAmount || inv.total.toFixed(2),
    }));
  };

  const rows = data.lines.filter((l) => l.desc.trim());
  const invalid = !data.customer.trim() || !rows.length || rows.some((l) => !(Number(l.amount) >= 0) || l.amount === "");

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="customer_code" value={data.customerCode} />
      <input type="hidden" name="customer" value={data.customer} />
      <input type="hidden" name="received_from" value={data.receivedFrom} />
      <input type="hidden" name="salesperson" value={data.salesperson} />
      <input type="hidden" name="receipt_date" value={data.date} />
      <input type="hidden" name="cash_amount" value={data.cashAmount} />
      <input type="hidden" name="cheque_bank" value={data.chequeBank} />
      <input type="hidden" name="cheque_branch" value={data.chequeBranch} />
      <input type="hidden" name="cheque_no" value={data.chequeNo} />
      <input type="hidden" name="cheque_date" value={data.chequeDate} />
      <input type="hidden" name="cheque_amount" value={data.chequeAmount} />
      <input type="hidden" name="company" value={JSON.stringify(data.company)} />
      <input type="hidden" name="lines" value={JSON.stringify(rows.map((l) => ({ desc: l.desc, qty: l.qty, amount: Number(l.amount) })))} />

      <div className="card flex flex-wrap items-end gap-4 print:hidden">
        {!preview ? (
          <>
            {invoices.length > 0 && (
              <label className="text-sm">
                {t.recImport}
                <select className="input mt-1" value="" onChange={(e) => importInvoice(e.target.value)}>
                  <option value="">—</option>
                  {invoices.map((i) => <option key={i.id} value={i.id}>{i.number} · {i.customer}</option>)}
                </select>
              </label>
            )}
            <DocVariantSelect value={data.variant ?? "original"} label={t.docVariant} onChange={(v) => setData((d) => ({ ...d, variant: v }))} />
            <button type="button" className="btn-ghost" onClick={() => {
              if (editCompany) saveCompanyDefault("receipt", data.company);
              setEditCompany((v) => !v);
            }}>
              ✎ {editCompany ? t.docDoneEditing : t.docEditCompany}
            </button>
            <button name="intent" value="draft" formNoValidate disabled={pending} className="btn-ghost ml-auto">💾 {t.saveDraft}</button>
            <button type="button" className="btn" disabled={invalid} onClick={() => { setPreview(true); window.scrollTo({ top: 0 }); }}>
              {t.docPreview} →
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn-ghost" onClick={() => setPreview(false)}>← {t.docBackToEdit}</button>
            <button type="button" className="btn-ghost" onClick={() => window.print()}>🖨 {t.docPrint}</button>
            <button name="intent" value="draft" disabled={pending} className="btn-ghost ml-auto">💾 {t.saveDraft}</button>
            <button name="intent" value="final" disabled={pending} className="btn">{t.recCreate}</button>
          </>
        )}
        <p className="w-full text-sm text-muted">{preview ? t.docPreviewNote : t.recNote}</p>
        {state?.error && <p className="w-full text-red-600">{t.saveFailed}</p>}
      </div>

      <div className="overflow-x-auto pb-4">
        <ReceiptPaper
          data={data}
          h={preview ? undefined : h}
          salesSlot={<SalesPicker initial={salespeople} value={data.salesperson} onChange={(v) => setData((d) => ({ ...d, salesperson: v }))} labels={{ add: t.salesAdd, remove: t.remove, save: t.save, confirm: t.salesRemoveConfirm }} />} editCompany={editCompany && !preview} />
      </div>
    </form>
  );
}
