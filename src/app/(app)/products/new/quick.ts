"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { splitBrandModel } from "@/lib/brandModel";

export type QuickProduct = { id: string; name: string; model: string | null; brand: string | null; unit: string; stock: number };

// Adds a product from inside a form's picker when it isn't in the database yet. The text is "Brand Model".
export async function quickCreateProduct(typed: string): Promise<QuickProduct | null> {
  const bm = splitBrandModel(typed);
  if (!bm) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .insert(bm)
    .select("id, name:display_name, model, brand, unit")
    .single();
  if (error || !data) return null;
  revalidatePath("/products");
  revalidatePath("/stock-list");
  return { ...data, stock: 0 };
}
