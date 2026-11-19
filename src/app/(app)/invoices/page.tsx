import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { invoiceTotals } from "@/lib/taxInvoice";
import { RequesterFilter, byRequester } from "@/components/RequesterFilter";
import { DraftList } from "@/components/DraftList";
import type { QuoteLine } from "@/lib/quotation";

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const { r: sel = "" } = await searchParams;
  const { lang, t } = await getDictionary();
  const supabase = await createClient();
  const { data: all } = await supabase
    .from("tax_invoices")
    .select("id, number, invoice_date, customer, vat, lines, status, updated_at, requester")
    .order("updated_at", { ascending: false })
    .limit(200);
  const drafts = (all ?? []).filter((i) => i.status === "draft");
  const finals = (all ?? []).filter((i) => i.status === "final");
  const invoices = byRequester(finals, sel);
  const money = (n: number) =>
    n.toLocaleString(lang === "th" ? "th-TH" : "en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">{t.taxInvoices}</h1>
        <Link href="/invoices/new" className="btn">{t.newTaxInvoice}</Link>
      </div>
      <DraftList rows={drafts} base="/invoices" kind="invoices" t={t} lang={lang} />
      <RequesterFilter rows={finals} selected={sel} base="/invoices" t={t} />
      <div className="card overflow-x-auto p-4">
        {invoices.length ? (
          <table className="data-table w-full text-left text-sm">
            <thead>
              <tr>
                <th className="py-2 pr-3">{t.invNumber}</th>
                <th className="pr-3">{t.invDate}</th>
                <th className="pr-3">{t.invCustomer}</th>
                <th className="pr-3">{t.requesterShort}</th>
                <th className="pr-3 text-right">{t.invGrandTotal}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id} className="border-t border-zinc-100">
                  <td className="py-2 pr-3">
                    <Link href={`/invoices/${i.id}`} className="font-semibold text-navy underline">{i.number}</Link>
                  </td>
                  <td className="pr-3">{new Date(i.invoice_date).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", { timeZone: "Asia/Bangkok" })}</td>
                  <td className="pr-3">{i.customer}</td>
                  <td className="pr-3">{i.requester || "—"}</td>
                  <td className="pr-3 text-right">{money(invoiceTotals(i.lines as QuoteLine[], i.vat).total)}</td>
                  <td>
                    <a href={`/invoices/${i.id}/pdf`} target="_blank" className="btn-ghost">PDF</a> <a href={`/invoices/${i.id}/pdf?download=1`} className="btn-ghost" title="Download PDF">⬇</a> <a href={`/invoices/${i.id}/xlsx`} className="btn-ghost" title="Download Excel">XLS</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-muted">{t.noItems}</p>
        )}
      </div>
    </section>
  );
}
