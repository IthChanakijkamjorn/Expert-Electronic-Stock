"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const money = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  return n >= 0 ? n : null;
};

export async function setPrices(productId: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("product_prices").upsert(
    {
      product_id: productId,
      cost: money(formData.get("cost")),
      sell_price: money(formData.get("sell_price")),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "product_id" },
  );
  if (error) throw new Error(error.message);
  revalidatePath(`/products/${productId}`);
  revalidatePath("/projects", "layout");
}
