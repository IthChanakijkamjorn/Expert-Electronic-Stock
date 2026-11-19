import { parseVariant } from "@/lib/docType";
import { createClient } from "@/lib/supabase/server";
import { buildTaxInvoice } from "@/lib/taxInvoice";
import type { QuoteLine } from "@/lib/quotation";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const variant = parseVariant(new URL(req.url).searchParams.get("doc"));
  const supabase = await createClient();
  const { data: inv } = await supabase.from("tax_invoices").select("*").eq("id", id).maybeSingle();
  if (!inv) return new Response("not found", { status: 404 });

  const pdf = await buildTaxInvoice({
    number: inv.number ?? "DRAFT",
    date: new Date(inv.invoice_date),
    customerCode: inv.customer_code,
    customer: inv.customer,
    address: inv.address,
    taxId: inv.tax_id,
    branch: inv.branch,
    salesperson: inv.salesperson,
    vat: inv.vat,
    variant,
    lines: inv.lines as QuoteLine[],
    company: inv.company,
  });
  return new Response(Buffer.from(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `${new URL(req.url).searchParams.get("download") ? "attachment" : "inline"}; filename="${inv.number ?? "DRAFT"}.pdf"` },
  });
}
