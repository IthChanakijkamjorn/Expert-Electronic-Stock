"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/role";

async function guard() {
  const role = await getRole();
  if (role !== "admin" && role !== "manager") throw new Error("forbidden");
}

export async function addBrandFile(brand: string, path: string, name: string, size: number) {
  await guard();
  if (!path.startsWith("catalogs/")) throw new Error("bad path");
  const supabase = await createClient();
  const { error } = await supabase.from("brand_files").insert({ brand, storage_path: path, file_name: name, size_bytes: size });
  if (error) throw new Error(error.message);
}

export async function deleteBrandFile(fileId: string) {
  await guard();
  const supabase = await createClient();
  const { data } = await supabase.from("brand_files").select("storage_path").eq("id", fileId).single();
  if (!data) return;
  await supabase.storage.from("files").remove([data.storage_path]);
  await supabase.from("brand_files").delete().eq("id", fileId);
  revalidatePath("/products", "layout");
}
