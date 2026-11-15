"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createLocation(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const supabase = await createClient();
  const { error } = await supabase.from("locations").insert({ name });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function renameLocation(id: string, name: string) {
  const clean = name.trim();
  if (!clean) throw new Error("empty");
  const supabase = await createClient();
  const { error } = await supabase.from("locations").update({ name: clean }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
