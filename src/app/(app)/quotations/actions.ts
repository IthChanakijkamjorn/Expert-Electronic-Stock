"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/role";
import { resolveLines, type RawLine } from "@/lib/resolveLines";

export type QuotationState = { error?: "invalid" | "failed" } | null;

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;
const num = (f: FormData, k: string) => {
  const v = text(f, k);
  return v === null || Number.isNaN(Number(v)) ? null : Math.max(0, Number(v));
};

export async function saveQuotation(id: string | null, _prev: QuotationState, formData: FormData): Promise<QuotationState> {
  const role = await getRole();
  if (role !== "admin" && role !== "manager") return { error: "failed" };
  const draft = formData.get("intent") === "draft";
  const customer = text(formData, "customer") ?? (draft ? "-" : null);
  let raw: RawLine[] = [];
  let company: unknown = null;
  try {
    raw = JSON.parse(String(formData.get("lines") ?? "[]"));
    company = JSON.parse(String(formData.get("company") ?? "null"));
  } catch {
    return { error: "invalid" };
  }
  if (!customer || !Array.isArray(raw)) return { error: "invalid" };

  const supabase = await createClient();
  const resolved = await resolveLines(supabase, raw, draft);
  if ("error" in resolved) return { error: resolved.error };
  const lines = resolved.lines;
  if (!draft && !lines.length) return { error: "invalid" };

  const payload = {
      project_id: text(formData, "project_id"),
      project_label: text(formData, "project_label"),
      quote_date: text(formData, "quote_date") ?? undefined,
      customer,
      attention: text(formData, "attention"),
      phone: text(formData, "phone"),
      email: text(formData, "email"),
      valid_days: num(formData, "valid_days"),
      lead_days: num(formData, "lead_days"),
      warranty_years: num(formData, "warranty_years"),
      payment_terms: text(formData, "payment_terms"),
      discount_pct: Math.min(100, num(formData, "discount_pct") ?? 0),
      vat: formData.get("vat") === "1",
      quoted_by: text(formData, "quoted_by"),
      signature_id: text(formData, "signature_id"),
      requester: text(formData, "requester"),
      company,
      lines,
      status: draft ? "draft" : "final",
      updated_at: new Date().toISOString(),
    };
  const { data: created, error } = id
    ? await supabase.from("quotations").update(payload).eq("id", id).select("id").single()
    : await supabase.from("quotations").insert(payload).select("id").single();
  if (error || !created) return { error: "failed" };
  revalidatePath("/quotations");
  revalidatePath("/documents");
  redirect(`/quotations/${created.id}?created=1`);
}
