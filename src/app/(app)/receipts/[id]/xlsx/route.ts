import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/role";
import { receiptXlsx, xlsxResponse } from "@/lib/excel";
import { mergeDocCompany } from "@/lib/company";
import type { ReceiptLine } from "@/lib/receipt";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const role = await getRole();
  if (role !== "admin" && role !== "manager") return new Response("forbidden", { status: 403 });
  const supabase = await createClient();
  const { data: r } = await supabase.from("receipts").select("*").eq("id", id).maybeSingle();
  if (!r) return new Response("not found", { status: 404 });
  const buf = await receiptXlsx({
    number: r.number ?? "DRAFT",
    date: r.receipt_date,
    customerCode: r.customer_code,
    customer: r.customer,
    receivedFrom: r.received_from,
    salesperson: r.salesperson,
    lines: r.lines as ReceiptLine[],
    cashAmount: Number(r.cash_amount),
    chequeBank: r.cheque_bank,
    chequeBranch: r.cheque_branch,
    chequeNo: r.cheque_no,
    chequeDate: r.cheque_date,
    chequeAmount: Number(r.cheque_amount),
    company: mergeDocCompany(r.company, "receipt"),
  });
  return xlsxResponse(buf, r.number ?? "DRAFT");
}
