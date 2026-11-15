"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/role";
import { logAudit } from "@/lib/audit";

export async function submitStocktake(brand: string, locationId: string, formData: FormData) {
  const role = await getRole();
  if (role !== "admin" && role !== "manager") return;

  const counts = new Map<string, number>();
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("count_") || String(value).trim() === "") continue;
    const n = Math.floor(Number(value));
    if (Number.isFinite(n) && n >= 0) counts.set(key.slice(6), n);
  }
  if (!counts.size) redirect(`/stocktake?brand=${encodeURIComponent(brand)}&loc=${locationId}&done=0`);

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("product_location_stock")
    .select("product_id, qty")
    .eq("location_id", locationId)
    .in("product_id", [...counts.keys()]);
  const have = new Map((current ?? []).map((r) => [r.product_id, r.qty]));

  const comment = `Stocktake ${new Date().toISOString().slice(0, 10)}`;
  const rows = [...counts.entries()]
    .map(([id, n]) => ({ id, diff: n - (have.get(id) ?? 0) }))
    .filter((r) => r.diff !== 0)
    .map((r) => ({
      product_id: r.id,
      location_id: locationId,
      quantity: r.diff,
      type: "count_correction" as const,
      comment,
    }));

  if (rows.length) {
    const { error } = await supabase.from("stock_movements").insert(rows);
    if (error) throw new Error(error.message);
    await logAudit("stocktake", "brand", `${brand} (${rows.length})`);
  }
  revalidatePath("/", "layout");
  redirect(`/stocktake?brand=${encodeURIComponent(brand)}&loc=${locationId}&done=${rows.length}`);
}
