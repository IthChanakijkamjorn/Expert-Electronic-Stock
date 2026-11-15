import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/role";
import { buildReceipt, type ReceiptLine } from "@/lib/receipt";
import { parseVariant } from "@/lib/docType";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const role = await getRole();
  if (role !== "admin" && role !== "manager") return new Response("forbidden", { status: 403 });
  const supabase = await createClient();
  const { data: r } = await supabase.from("receipts").select("*").eq("id", id).maybeSingle();
  if (!r) return new Response("not found", { status: 404 });

  const pdf = await buildReceipt({
    number: r.number,
    date: new Date(r.receipt_date),
    variant: parseVariant(new URL(req.url).searchParams.get("doc")),
    customerCode: r.customer_code,
    customer: r.customer,
    receivedFrom: r.received_from,
    salesperson: r.salesperson,
    lines: r.lines as ReceiptLine[],
    cashAmount: Number(r.cash_amount),
    chequeBank: r.cheque_bank,
    chequeBranch: r.cheque_branch,
    chequeNo: r.cheque_no,
    chequeDate: r.cheque_date ? new Date(r.cheque_date) : null,
    chequeAmount: Number(r.cheque_amount),
    company: r.company,
  });
  return new Response(Buffer.from(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${r.number}.pdf"` },
  });
}
