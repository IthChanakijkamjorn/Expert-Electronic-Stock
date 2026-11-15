import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";
import { invoiceTotals } from "@/lib/taxInvoice";
import type { QuoteLine } from "@/lib/quotation";
import { ReceiptForm } from "./ReceiptForm";

export default async function NewReceiptPage() {
  const role = await getRole();
  if (role !== "admin" && role !== "manager") redirect("/documents");
  const { t } = await getDictionary();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const [{ data: invoices }, { data: me }] = await Promise.all([
    supabase.from("tax_invoices").select("id, number, customer_code, customer, vat, lines").order("created_at", { ascending: false }).limit(100),
    supabase.from("profiles").select("full_name").eq("id", claims?.claims.sub ?? "").maybeSingle(),
  ]);
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold">{t.newReceipt}</h1>
      <ReceiptForm
        t={t}
        salesperson={me?.full_name ?? ""}
        invoices={(invoices ?? []).map((i) => ({
          id: i.id,
          number: i.number,
          customerCode: i.customer_code ?? "",
          customer: i.customer,
          total: invoiceTotals(i.lines as QuoteLine[], i.vat).total,
        }))}
      />
    </section>
  );
}
