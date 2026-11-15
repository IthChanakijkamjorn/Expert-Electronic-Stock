"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addProductFile(
  productId: string,
  path: string,
  name: string,
  size: number,
) {
  if (!path.startsWith(`products/${productId}/`)) throw new Error("bad path");
  const supabase = await createClient();
  const { error } = await supabase
    .from("product_files")
    .insert({ product_id: productId, storage_path: path, file_name: name, size_bytes: size });
  if (error) throw new Error(error.message);
}

export async function deleteProductFile(fileId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_files")
    .select("storage_path")
    .eq("id", fileId)
    .single();
  if (!data) return;
  await supabase.storage.from("files").remove([data.storage_path]);
  await supabase.from("product_files").delete().eq("id", fileId);
  revalidatePath("/products", "layout");
}

export async function createShare(path: string, fileName: string, hours: number) {
  const safeHours = Math.min(Math.max(Math.floor(hours) || 168, 1), 2160);
  const expires = new Date(Date.now() + safeHours * 3600000).toISOString();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("file_shares")
    .insert({ storage_path: path, file_name: fileName, expires_at: expires })
    .select("token")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/products");
  return data.token as string;
}

export async function revokeShare(shareId: string) {
  const supabase = await createClient();
  await supabase
    .from("file_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", shareId);
  revalidatePath("/products");
}

export async function deleteProduct(productId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ active: false }).eq("id", productId);
  if (error) throw new Error(error.message);
  revalidatePath("/products", "layout");
  redirect("/products");
}

export async function renameProduct(productId: string, name: string) {
  const clean = name.trim();
  if (!clean) throw new Error("empty name");
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ name: clean }).eq("id", productId);
  if (error) throw new Error(error.message);
  revalidatePath("/products", "layout");
  revalidatePath("/movements");
}
