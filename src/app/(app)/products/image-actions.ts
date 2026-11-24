"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { syncQuietly } from "@/lib/website";

export async function setProductImage(productId: string, path: string) {
  if (!path.startsWith(`images/products/${productId}/`)) throw new Error("bad path");
  const supabase = await createClient();
  const { data: old } = await supabase.from("products").select("image_path").eq("id", productId).single();
  const { error } = await supabase.from("products").update({ image_path: path }).eq("id", productId);
  if (error) throw new Error(error.message);
  if (old?.image_path) await supabase.storage.from("files").remove([old.image_path]);
  await syncQuietly(supabase, productId);
  revalidatePath("/products", "layout");
}

export async function setBrandLogo(brand: string, path: string) {
  if (!path.startsWith("images/brands/")) throw new Error("bad path");
  const supabase = await createClient();
  const { data: old } = await supabase.from("brands").select("logo_path").eq("name", brand).maybeSingle();
  const { error } = await supabase.from("brands").upsert({ name: brand, logo_path: path });
  if (error) throw new Error(error.message);
  if (old?.logo_path) await supabase.storage.from("files").remove([old.logo_path]);
  revalidatePath("/products", "layout");
}
