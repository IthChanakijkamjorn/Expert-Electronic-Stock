"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export type GoodsState = { error?: "invalid" | "failed"; id?: string } | null;

export async function createGoodsReceipt(formData: FormData): Promise<GoodsState> {
  const supplier = String(formData.get("supplier") ?? "").trim();
  const ids = formData.getAll("product_id").map(String);
  const qtys = formData.getAll("qty").map((v) => Math.floor(Number(v)));
  const costs = formData.getAll("unit_cost").map(String);
  const lines = ids
    .map((id, i) => ({ product_id: id, qty: qtys[i], unit_cost: costs[i]?.trim() ? Number(costs[i]) : null }))
    .filter((l) => l.product_id);
  if (!supplier || !lines.length || lines.some((l) => !(l.qty > 0) || (l.unit_cost !== null && !(l.unit_cost >= 0)))) {
    return { error: "invalid" };
  }
  const filePath = String(formData.get("file_path") ?? "") || null;
  if (filePath && !filePath.startsWith("goods-receipts/")) return { error: "invalid" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("receive_goods", {
    p_supplier: supplier,
    p_reference: String(formData.get("reference") ?? ""),
    p_note: String(formData.get("note") ?? ""),
    p_loc: String(formData.get("location_id") ?? "") || null,
    p_date: String(formData.get("date") ?? "") || null,
    p_file_path: filePath,
    p_file_name: filePath ? String(formData.get("file_name") ?? "") || null : null,
    p_lines: lines,
  } as never);
  if (error) return { error: "failed" };
  await logAudit("receive", "goods_receipt", supplier);
  revalidatePath("/goods-receipts");
  revalidatePath("/products");
  revalidatePath("/stock-list");
  revalidatePath("/", "layout");
  return { id: data as unknown as string };
}
