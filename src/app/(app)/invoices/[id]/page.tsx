import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { invoiceTotals } from "@/lib/taxInvoice";
import type { QuoteLine } from "@/lib/quotation";

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;
  const { lang, t } = await getDictionary();
  const supabase = await createClient();
  const { data: inv } = await supabase.from("tax_invoices").select("*").eq("id", id).maybeSingle();
  if (!inv) notFound();

  const lines = inv.lines as QuoteLine[];
  const { subtotal, vatAmount, total } = invoiceTotals(lines, inv.vat);
  const money = (n: number) =>
    n.toLocaleString(lang === "th" ? "th-TH" : "en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">{inv.number}</h1>
        <div className="flex gap-2">
          <Link href="/invoices" className="btn-ghost">← {t.taxInvoices}</Link>
          <a href={`/invoices/${id}/pdf`} target="_blank" className="btn">{t.invOpenPdf}</a>
        </div>
      </div>
      {created && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700">{t.invCreated}</p>}
      <div className="card flex flex-col gap-1 text-sm">
        <p><b>{t.invCustomer}:</b> {inv.customer} {inv.customer_code && `(${inv.customer_code})`}</p>
        {inv.address && <p><b>{t.invAddress}:</b> {inv.address}</p>}
        {(inv.tax_id || inv.branch) && <p><b>{t.invTaxId}:</b> {inv.tax_id} {inv.branch && `· ${t.invBranch} ${inv.branch}`}</p>}
        <p><b>{t.invDate}:</b> {new Date(inv.invoice_date).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB")}</p>
        {inv.salesperson && <p><b>{t.invSalesperson}:</b> {inv.salesperson}</p>}
      </div>
      <div className="card overflow-x-auto p-4">
        <table className="data-table w-full text-left text-sm">
          <thead>
            <tr>
              <th className="py-2 pr-3">#</th>
              <th className="pr-3">{t.invBrand}</th>
              <th className="pr-3">{t.invModel}</th>
              <th className="pr-3">{t.invDescription}</th>
              <th className="pr-3 text-right">{t.quantity}</th>
              <th className="pr-3 text-right">{t.invUnitPrice}</th>
              <th className="text-right">{t.invAmount}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-t border-zinc-100">
                <td className="py-2 pr-3">{i + 1}</td>
                <td className="pr-3">{l.brand}</td>
                <td className="pr-3">{l.model}</td>
                <td className="pr-3">{l.name}</td>
                <td className="pr-3 text-right">{l.qty} {l.unit}</td>
                <td className="pr-3 text-right">{money(l.price)}</td>
                <td className="text-right">{money(l.qty * l.price)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-zinc-200"><td colSpan={6} className="py-1 text-right">{t.invSubtotal}</td><td className="text-right">{money(subtotal)}</td></tr>
            <tr><td colSpan={6} className="py-1 text-right">{t.invVat}</td><td className="text-right">{inv.vat ? money(vatAmount) : "-"}</td></tr>
            <tr className="font-semibold"><td colSpan={6} className="py-1 text-right">{t.invGrandTotal}</td><td className="text-right">{money(total)}</td></tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
