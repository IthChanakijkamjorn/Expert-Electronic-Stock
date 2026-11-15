"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type InvoiceState = { error?: "invalid" | "insufficient" | "failed" } | null;

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;

export async function createInvoice(_prev: InvoiceState, formData: FormData): Promise<InvoiceState> {
  const customer = text(formData, "customer");
  let raw: { product_id: string; qty: number; price: number }[] = [];
  try {
    raw = JSON.parse(String(formData.get("lines") ?? "[]"));
  } catch {
    return { error: "invalid" };
  }
  if (!customer || !Array.isArray(raw) || !raw.length) return { error: "invalid" };

  const wanted = new Map<string, { qty: number; price: number }>();
  for (const l of raw) {
    const qty = Math.floor(Number(l.qty));
    const price = Number(l.price);
    if (!l.product_id || !(qty > 0) || !(price >= 0)) return { error: "invalid" };
    const cur = wanted.get(l.product_id);
    wanted.set(l.product_id, { qty: (cur?.qty ?? 0) + qty, price });
  }

  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, name, sku, brand, unit")
    .in("id", [...wanted.keys()]);
  if (products?.length !== wanted.size) return { error: "invalid" };
  const lines = products.map((p) => ({
    product_id: p.id,
    brand: p.brand ?? "",
    model: p.sku ?? "",
    name: p.name,
    unit: p.unit,
    qty: wanted.get(p.id)!.qty,
    price: wanted.get(p.id)!.price,
  }));

  const { data: id, error } = await supabase.rpc("create_tax_invoice", {
    p_customer_code: text(formData, "customer_code"),
    p_customer: customer,
    p_address: text(formData, "address"),
    p_tax_id: text(formData, "tax_id"),
    p_branch: text(formData, "branch"),
    p_salesperson: text(formData, "salesperson"),
    p_invoice_date: text(formData, "invoice_date"),
    p_project_id: text(formData, "project_id"),
    p_location_id: text(formData, "location_id"),
    p_vat: formData.get("vat") === "1",
    p_lines: lines,
  });
  if (error || !id) {
    return { error: error?.message.includes("insufficient_stock") ? "insufficient" : "failed" };
  }
  revalidatePath("/invoices");
  revalidatePath("/movements");
  revalidatePath("/products");
  revalidatePath("/projects", "layout");
  redirect(`/invoices/${id}?created=1`);
}
