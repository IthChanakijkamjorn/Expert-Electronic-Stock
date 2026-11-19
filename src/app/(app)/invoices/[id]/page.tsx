import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { mergeDocCompany } from "@/lib/company";
import { InvoicePaper } from "@/components/InvoicePaper";
import { parseVariant } from "@/lib/docType";
import { DocVariantSelect } from "@/components/DocVariantSelect";
import type { QuoteLine } from "@/lib/quotation";

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; doc?: string }>;
}) {
  const { id } = await params;
  const { created, doc } = await searchParams;
  const variant = parseVariant(doc);
  const { t } = await getDictionary();
  const supabase = await createClient();
  const { data: inv } = await supabase.from("tax_invoices").select("*").eq("id", id).maybeSingle();
  if (!inv) notFound();

  return (
    <section className="flex flex-col gap-4">
      <div className="card flex flex-wrap items-center gap-3 print:hidden">
        <h1 className="text-2xl font-semibold">{inv.number ?? t.draftLabel}</h1>
        {inv.status === "draft" && <span className="pill">{t.draftLabel}</span>}
        <div className="ml-auto flex flex-wrap gap-2">
          <Link href="/invoices" className="btn-ghost">← {t.taxInvoices}</Link>
          <Link href={`/invoices/${id}/edit`} className="btn-ghost">✎ {t.docEdit}</Link>
          <DocVariantSelect value={variant} label={t.docVariant} />
          <a href={`/invoices/${id}/pdf?doc=${variant}`} target="_blank" className="btn">{t.invOpenPdf}</a>
          <a href={`/invoices/${id}/pdf?doc=${variant}&download=1`} className="btn">⬇ {t.docDownloadPdf}</a>
        </div>
        {created && <p className="w-full rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700">{inv.status === "draft" ? t.draftSaved : t.invCreated}</p>}
      </div>
      <div className="overflow-x-auto pb-4">
        <InvoicePaper
          data={{
            number: inv.number ?? "DRAFT",
            company: mergeDocCompany(inv.company),
            customerCode: inv.customer_code ?? "",
            customer: inv.customer,
            address: inv.address ?? "",
            taxId: inv.tax_id ?? "",
            branch: inv.branch ?? "",
            salesperson: inv.salesperson ?? "",
            date: inv.invoice_date,
            vat: inv.vat,
            variant,
            lines: (inv.lines as QuoteLine[]).map((l, i) => ({
              key: String(i),
              brand: l.brand,
              model: l.model,
              name: l.name,
              unit: l.unit,
              qty: String(l.qty),
              price: String(l.price),
            })),
          }}
        />
      </div>
    </section>
  );
}
