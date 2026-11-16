"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const text = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v || null;
};

export async function createProduct(
  _prev: { error: boolean } | null,
  formData: FormData,
) {
  const name = text(formData, "name");
  if (!name) return { error: true };
  const supabase = await createClient();
  const { error } = await supabase.from("products").insert({
    name,
    model: text(formData, "model"),
    brand: text(formData, "brand"),
    category: text(formData, "category"),
    unit: text(formData, "unit") ?? "pcs",
    supplier: text(formData, "supplier"),
  });
  if (error) return { error: true };
  redirect("/products");
}
