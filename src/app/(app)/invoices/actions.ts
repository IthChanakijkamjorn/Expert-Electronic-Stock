"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveLines, type RawLine } from "@/lib/resolveLines";

export type InvoiceState = { error?: "invalid" | "insufficient" | "failed" } | null;

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;

export async function saveInvoice(id: string | null, _prev: InvoiceState, formData: FormData): Promise<InvoiceState> {
  const draft = formData.get("intent") === "draft";
  const customer = text(formData, "customer") ?? (draft ? "-" : null);
  let raw: RawLine[] = [];
  try {
    raw = JSON.parse(String(formData.get("lines") ?? "[]"));
  } catch {
    return { error: "invalid" };
  }
  if (!customer || !Array.isArray(raw)) return { error: "invalid" };

  let company: unknown = null;
  try {
    company = JSON.parse(String(formData.get("company") ?? "null"));
  } catch {}

  const supabase = await createClient();
  const resolved = await resolveLines(supabase, raw, draft);
  if ("error" in resolved) return { error: resolved.error };
  const lines = resolved.lines;
  if (!draft && !lines.length) return { error: "invalid" };

  const { data: savedId, error } = await supabase.rpc("save_tax_invoice", {
    p_id: id,
    p_status: draft ? "draft" : "final",
    p_customer_code: text(formData, "customer_code"),
    p_customer: customer,
    p_address: text(formData, "address"),
    p_tax_id: text(formData, "tax_id"),
    p_branch: text(formData, "branch"),
    p_salesperson: text(formData, "salesperson"),
    p_invoice_date: text(formData, "invoice_date"),
    p_project_id: text(formData, "project_id"),
    p_vat: formData.get("vat") === "1",
    p_lines: lines,
    p_company: company,
  });
  if (error || !savedId) {
    return { error: error?.message.includes("insufficient_stock") ? "insufficient" : "failed" };
  }
  await supabase.from("tax_invoices").update({ requester: text(formData, "requester") }).eq("id", savedId);
  revalidatePath("/invoices");
  revalidatePath("/documents");
  revalidatePath("/movements");
  revalidatePath("/products");
  revalidatePath("/projects", "layout");
  redirect(`/invoices/${savedId}?created=1`);
}
