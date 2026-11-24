"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dictionaries } from "@/lib/i18n/dictionaries";

// Reasons allowed per direction; the project is only kept for these reasons.
const TYPES = {
  in: ["purchase", "return_from_site", "count_correction", "other"],
  out: ["sale", "project_use", "count_correction", "other"],
} as const;
const PROJECT_TYPES = new Set(["return_from_site", "project_use"]);

export type MovementState = { error?: "invalid" | "insufficient" | "project" | "failed"; ok?: boolean; at?: number } | null;

export async function recordMovement(_prev: MovementState, formData: FormData): Promise<MovementState> {
  const direction = formData.get("direction") === "out" ? "out" : "in";
  const productId = String(formData.get("product_id") ?? "");
  const type = String(formData.get("type") ?? "");
  const note = String(formData.get("comment") ?? "").trim().slice(0, 1000);
  const supplier = direction === "in" ? String(formData.get("supplier") ?? "").trim().slice(0, 200) : "";
  const qty = Math.floor(Number(formData.get("quantity")));
  const projectId = PROJECT_TYPES.has(type) ? String(formData.get("project_id") ?? "") || null : null;
  if (!productId || !(TYPES[direction] as readonly string[]).includes(type) || !(qty > 0)) return { error: "invalid" };
  if (type === "project_use" && !projectId) return { error: "project" };

  const supabase = await createClient();
  // 'sale' movements are allowed below zero for tax invoices, so manual sales are checked here.
  if (direction === "out" && type === "sale") {
    const { data: p } = await supabase.from("product_stock").select("stock").eq("id", productId).maybeSingle();
    if (!p || p.stock < qty) return { error: "insufficient" };
  }
  // The comment column is required, so it is built from the supplier and note, falling back to the reason.
  const th = dictionaries.th;
  const label = type === "sale" ? th.mv.sale : th.movementTypes[type as keyof typeof th.movementTypes];
  const comment = [supplier && `${th.mv.purchasedFrom} ${supplier}`, note].filter(Boolean).join(" · ") || label;

  const { error } = await supabase.from("stock_movements").insert({
    product_id: productId,
    type,
    comment,
    quantity: (direction === "out" ? -1 : 1) * qty,
    project_id: projectId,
  });
  if (error) return { error: error.message.includes("insufficient_stock") ? "insufficient" : "failed" };
  revalidatePath("/movements");
  revalidatePath("/products");
  revalidatePath("/projects", "layout");
  return { ok: true, at: Date.now() };
}
