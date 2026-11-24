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
  const brand = text(formData, "brand");
  const model = text(formData, "model");
  if (!brand || !model) return { error: true };
  const supabase = await createClient();
  const { error } = await supabase.from("products").insert({
    name: text(formData, "name"),
    model,
    brand,
    description: text(formData, "description"),
    category: text(formData, "category"),
    unit: text(formData, "unit") ?? "ชิ้น",
    supplier: text(formData, "supplier"),
  });
  if (error) return { error: true };
  redirect("/products");
}
