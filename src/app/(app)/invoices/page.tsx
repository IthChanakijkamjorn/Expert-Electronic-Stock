import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { invoiceTotals } from "@/lib/taxInvoice";
import type { QuoteLine } from "@/lib/quotation";

export default async function InvoicesPage() {
  const { lang, t } = await getDictionary();
  const supabase = await createClient();
  const { data: invoices } = await supabase
    .from("tax_invoices")
    .select("id, number, invoice_date, customer, vat, lines")
    .order("created_at", { ascending: false })
    .limit(200);
  const money = (n: number) =>
    n.toLocaleString(lang === "th" ? "th-TH" : "en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">{t.taxInvoices}</h1>
        <Link href="/invoices/new" className="btn">{t.newTaxInvoice}</Link>
      </div>
      <div className="card overflow-x-auto p-4">
        {invoices?.length ? (
          <table className="data-table w-full text-left text-sm">
            <thead>
              <tr>
                <th className="py-2 pr-3">{t.invNumber}</th>
                <th className="pr-3">{t.invDate}</th>
                <th className="pr-3">{t.invCustomer}</th>
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
                  <td className="pr-3">{new Date(i.invoice_date).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB")}</td>
                  <td className="pr-3">{i.customer}</td>
                  <td className="pr-3 text-right">{money(invoiceTotals(i.lines as QuoteLine[], i.vat).total)}</td>
                  <td>
                    <a href={`/invoices/${i.id}/pdf`} target="_blank" className="btn-ghost">PDF</a>
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
