"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export async function createPurchaseOrder(formData: FormData) {
  const supplierId = String(formData.get("supplier_id") ?? "");
  if (!supplierId) return;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_orders")
    .insert({ supplier_id: supplierId, notes: String(formData.get("notes") ?? "").trim() || null })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  redirect(`/purchasing/${data.id}`);
}

export async function setPoLine(poId: string, formData: FormData) {
  const productId = String(formData.get("product_id") ?? "");
  const qty = Math.floor(Number(formData.get("qty")));
  const cost = Number(formData.get("unit_cost"));
  if (!productId || !(qty > 0) || !(cost >= 0)) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("purchase_order_lines")
    .upsert({ po_id: poId, product_id: productId, qty, unit_cost: cost }, { onConflict: "po_id,product_id" });
  if (error) throw new Error(error.message);
  revalidatePath(`/purchasing/${poId}`);
}

export async function removePoLine(poId: string, lineId: string) {
  const supabase = await createClient();
  await supabase.from("purchase_order_lines").delete().eq("id", lineId);
  revalidatePath(`/purchasing/${poId}`);
}

async function setStatus(poId: string, from: string, to: string) {
  const supabase = await createClient();
  await supabase.from("purchase_orders").update({ status: to }).eq("id", poId).eq("status", from);
  revalidatePath(`/purchasing/${poId}`);
  revalidatePath("/purchasing");
}

export async function markOrdered(poId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("purchase_order_lines")
    .select("id", { count: "exact", head: true })
    .eq("po_id", poId);
  if (!count) return;
  await setStatus(poId, "draft", "ordered");
}

export async function cancelOrder(poId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("purchase_orders").select("status").eq("id", poId).single();
  if (data && (data.status === "draft" || data.status === "ordered")) {
    await setStatus(poId, data.status, "cancelled");
  }
}

export async function receiveOrder(poId: string, formData: FormData) {
  const loc = String(formData.get("location_id") ?? "");
  if (!loc) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("receive_purchase_order", { po: poId, loc });
  if (error) throw new Error(error.message);
  await logAudit("receive", "purchase_order", poId);
  revalidatePath(`/purchasing/${poId}`);
  revalidatePath("/purchasing");
  revalidatePath("/", "layout");
}
