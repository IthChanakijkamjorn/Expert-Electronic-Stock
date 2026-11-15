import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";
import { mergeDocCompany } from "@/lib/company";
import { parseVariant } from "@/lib/docType";
import { ReceiptPaper } from "@/components/ReceiptPaper";
import { DocVariantSelect } from "@/components/DocVariantSelect";
import { PrintButton } from "@/components/PrintButton";

export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; doc?: string }>;
}) {
  const role = await getRole();
  if (role !== "admin" && role !== "manager") redirect("/documents");
  const { id } = await params;
  const { created, doc } = await searchParams;
  const variant = parseVariant(doc);
  const { t } = await getDictionary();
  const supabase = await createClient();
  const { data: r } = await supabase.from("receipts").select("*").eq("id", id).maybeSingle();
  if (!r) notFound();
  const s = (v: number) => (Number(v) ? String(Number(v)) : "");

  return (
    <section className="flex flex-col gap-4">
      <div className="card flex flex-wrap items-center gap-3 print:hidden">
        <h1 className="text-2xl font-semibold">{r.number ?? t.draftLabel}</h1>
        {r.status === "draft" && <span className="pill">{t.draftLabel}</span>}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Link href="/receipts" className="btn-ghost">← {t.receipt}</Link>
          <Link href={`/receipts/${id}/edit`} className="btn-ghost">✎ {t.docEdit}</Link>
          <DocVariantSelect value={variant} label={t.docVariant} />
          <PrintButton label={`🖨 ${t.docPrint}`} />
          <a href={`/receipts/${id}/pdf?doc=${variant}`} target="_blank" className="btn">{t.invOpenPdf}</a>
        </div>
        {created && <p className="w-full rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700">{r.status === "draft" ? t.draftSaved : t.docSaved}</p>}
      </div>
      <div className="overflow-x-auto pb-4">
        <ReceiptPaper
          data={{
            number: r.number ?? "DRAFT",
            company: mergeDocCompany(r.company, "receipt"),
            variant,
            customerCode: r.customer_code ?? "",
            customer: r.customer,
            receivedFrom: r.received_from ?? "",
            salesperson: r.salesperson ?? "",
            date: r.receipt_date,
            lines: (r.lines as { desc: string; qty: string; amount: number }[]).map((l, i) => ({
              key: String(i), desc: l.desc, qty: l.qty, amount: String(l.amount),
            })),
            cashAmount: s(r.cash_amount),
            chequeBank: r.cheque_bank ?? "",
            chequeBranch: r.cheque_branch ?? "",
            chequeNo: r.cheque_no ?? "",
            chequeDate: r.cheque_date ?? "",
            chequeAmount: s(r.cheque_amount),
          }}
        />
      </div>
    </section>
  );
}
