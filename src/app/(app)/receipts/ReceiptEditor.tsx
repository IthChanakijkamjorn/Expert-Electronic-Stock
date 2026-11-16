import { loadCompanyDefault } from "@/lib/companyDefaults";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";
import { invoiceTotals } from "@/lib/taxInvoice";
import type { QuoteLine } from "@/lib/quotation";
import { ReceiptForm } from "./new/ReceiptForm";
import { mergeDocCompany } from "@/lib/company";
import type { ReceiptPaperData } from "@/components/ReceiptPaper";

export async function ReceiptEditor({ id }: { id?: string }) {
  const role = await getRole();
  if (role !== "admin" && role !== "manager") redirect("/documents");
  const { t } = await getDictionary();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const [{ data: invoices }, { data: me }] = await Promise.all([
    supabase.from("tax_invoices").select("id, number, customer_code, customer, vat, lines").eq("status", "final").order("created_at", { ascending: false }).limit(100),
    supabase.from("profiles").select("full_name").eq("id", claims?.claims.sub ?? "").maybeSingle(),
  ]);
  let existing: ReceiptPaperData | undefined;
  if (id) {
    const { data: r } = await supabase.from("receipts").select("*").eq("id", id).maybeSingle();
    if (!r) notFound();
    const n = (v: number) => (Number(v) ? String(Number(v)) : "");
    const lines = (r.lines as { desc: string; qty: string; amount: number }[]).map((l, i) => ({
      key: `r${i}`, desc: l.desc, qty: l.qty, amount: String(l.amount),
    }));
    existing = {
      number: r.number ?? "DRAFT",
      company: mergeDocCompany(r.company, "receipt"),
      variant: "original",
      customerCode: r.customer_code ?? "",
      customer: r.status === "draft" && r.customer === "-" ? "" : r.customer,
      receivedFrom: r.received_from ?? "",
      salesperson: r.salesperson ?? "",
      date: r.receipt_date,
      lines: lines.length ? lines : [{ key: "r0", desc: "", qty: "", amount: "" }],
      cashAmount: n(r.cash_amount),
      chequeBank: r.cheque_bank ?? "",
      chequeBranch: r.cheque_branch ?? "",
      chequeNo: r.cheque_no ?? "",
      chequeDate: r.cheque_date ?? "",
      chequeAmount: n(r.cheque_amount),
    };
  }
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold">{id ? t.docEdit : t.newReceipt}</h1>
      <ReceiptForm
        t={t}
        defaultCompany={await loadCompanyDefault("receipt")}
        salesperson={me?.full_name ?? ""}
        existingId={id}
        existing={existing}
        invoices={(invoices ?? []).map((i) => ({
          id: i.id,
          number: i.number ?? "",
          customerCode: i.customer_code ?? "",
          customer: i.customer,
          total: invoiceTotals(i.lines as QuoteLine[], i.vat).total,
        }))}
      />
    </section>
  );
}
