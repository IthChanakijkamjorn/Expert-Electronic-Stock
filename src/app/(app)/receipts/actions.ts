"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/role";
import { RECEIPT_MAX_LINES } from "@/lib/receipt";

export type ReceiptState = { error?: "invalid" | "failed" } | null;

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;
const money = (f: FormData, k: string) => {
  const n = Number(text(f, k) ?? 0);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
};

export async function createReceipt(_prev: ReceiptState, formData: FormData): Promise<ReceiptState> {
  const role = await getRole();
  if (role !== "admin" && role !== "manager") return { error: "failed" };
  const customer = text(formData, "customer");
  let raw: { desc: string; qty: string; amount: number }[] = [];
  let company: unknown = null;
  try {
    raw = JSON.parse(String(formData.get("lines") ?? "[]"));
    company = JSON.parse(String(formData.get("company") ?? "null"));
  } catch {
    return { error: "invalid" };
  }
  const lines = (Array.isArray(raw) ? raw : [])
    .map((l) => ({ desc: String(l.desc ?? "").trim(), qty: String(l.qty ?? "").trim(), amount: Math.round(Number(l.amount) * 100) / 100 }))
    .filter((l) => l.desc);
  const cash = money(formData, "cash_amount");
  const cheque = money(formData, "cheque_amount");
  if (!customer || !lines.length || lines.length > RECEIPT_MAX_LINES || lines.some((l) => !(l.amount >= 0)) || Number.isNaN(cash) || Number.isNaN(cheque)) {
    return { error: "invalid" };
  }

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("receipts")
    .insert({
      receipt_date: text(formData, "receipt_date") ?? undefined,
      customer_code: text(formData, "customer_code"),
      customer,
      received_from: text(formData, "received_from"),
      salesperson: text(formData, "salesperson"),
      lines,
      cash_amount: cash,
      cheque_bank: text(formData, "cheque_bank"),
      cheque_branch: text(formData, "cheque_branch"),
      cheque_no: text(formData, "cheque_no"),
      cheque_date: text(formData, "cheque_date"),
      cheque_amount: cheque,
      company,
    })
    .select("id")
    .single();
  if (error || !created) return { error: "failed" };
  revalidatePath("/receipts");
  revalidatePath("/documents");
  redirect(`/receipts/${created.id}?created=1`);
}
