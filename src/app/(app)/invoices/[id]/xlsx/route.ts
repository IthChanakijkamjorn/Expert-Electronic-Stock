import { createClient } from "@/lib/supabase/server";
import { invoiceXlsx, xlsxResponse } from "@/lib/excel";
import { mergeDocCompany } from "@/lib/company";
import type { QuoteLine } from "@/lib/quotation";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: inv } = await supabase.from("tax_invoices").select("*").eq("id", id).maybeSingle();
  if (!inv) return new Response("not found", { status: 404 });
  const buf = await invoiceXlsx({
    number: inv.number ?? "DRAFT",
    date: inv.invoice_date,
    customerCode: inv.customer_code,
    customer: inv.customer,
    address: inv.address,
    taxId: inv.tax_id,
    branch: inv.branch,
    salesperson: inv.salesperson,
    vat: inv.vat,
    company: mergeDocCompany(inv.company, "invoice"),
    lines: inv.lines as QuoteLine[],
  });
  return xlsxResponse(buf, inv.number ?? "DRAFT");
}
