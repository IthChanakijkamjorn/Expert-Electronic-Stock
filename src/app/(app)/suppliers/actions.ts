"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;

export async function createSupplier(formData: FormData) {
  const name = text(formData, "name");
  if (!name) return;
  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").insert({
    name,
    contact: text(formData, "contact"),
    phone: text(formData, "phone"),
    email: text(formData, "email"),
    notes: text(formData, "notes"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/suppliers");
}

export async function renameSupplier(id: string, name: string) {
  const clean = name.trim();
  if (!clean) throw new Error("empty");
  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").update({ name: clean }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/suppliers");
}
