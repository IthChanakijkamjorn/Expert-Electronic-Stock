"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const TYPES = ["purchase", "return_from_site", "project_use", "count_correction", "other"];

export type MovementState = { error?: "invalid" | "insufficient" | "failed"; ok?: boolean } | null;

export async function recordMovement(_prev: MovementState, formData: FormData): Promise<MovementState> {
  const productId = String(formData.get("product_id") ?? "");
  const type = String(formData.get("type") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  const qty = Math.floor(Number(formData.get("quantity")));
  const projectId = String(formData.get("project_id") ?? "") || null;
  const locationId = String(formData.get("location_id") ?? "") || undefined;
  const sign = formData.get("direction") === "out" ? -1 : 1;
  if (!productId || !TYPES.includes(type) || !comment || !(qty > 0)) {
    return { error: "invalid" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("stock_movements").insert({
    product_id: productId,
    type,
    comment,
    quantity: sign * qty,
    project_id: projectId,
    location_id: locationId,
  });
  if (error) {
    return { error: error.message.includes("insufficient_stock") ? "insufficient" : "failed" };
  }
  revalidatePath("/movements");
  revalidatePath("/products");
  revalidatePath("/projects", "layout");
  return { ok: true };
}

export async function transferStock(productId: string, _prev: MovementState, formData: FormData): Promise<MovementState> {
  const from = String(formData.get("from") ?? "");
  const to = String(formData.get("to") ?? "");
  const qty = Math.floor(Number(formData.get("quantity")));
  const comment = String(formData.get("comment") ?? "").trim() || "Transfer";
  if (!from || !to || from === to || !(qty > 0)) return { error: "invalid" };

  const supabase = await createClient();
  const { error } = await supabase.from("stock_movements").insert([
    { product_id: productId, type: "transfer", comment, quantity: -qty, location_id: from },
    { product_id: productId, type: "transfer", comment, quantity: qty, location_id: to },
  ]);
  if (error) {
    return { error: error.message.includes("insufficient_stock") ? "insufficient" : "failed" };
  }
  revalidatePath("/movements");
  revalidatePath(`/products/${productId}`);
  return { ok: true };
}
