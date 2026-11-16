"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type QuickProduct = { id: string; name: string; sku: string | null; brand: string | null; unit: string; stock: number };

// Adds a product from inside a form's picker when it isn't in the database yet.
export async function quickCreateProduct(name: string): Promise<QuickProduct | null> {
  const clean = name.trim();
  if (!clean) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .insert({ name: clean })
    .select("id, name, sku, brand, unit")
    .single();
  if (error || !data) return null;
  revalidatePath("/products");
  revalidatePath("/stock-list");
  return { ...data, stock: 0 };
}
