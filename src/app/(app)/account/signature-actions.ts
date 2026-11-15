"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/role";

async function adminClient() {
  if ((await getRole()) !== "admin") throw new Error("forbidden");
  return createClient();
}

export async function addSignature(name: string, path: string) {
  const supabase = await adminClient();
  if (!path.startsWith("images/signature/")) throw new Error("bad path");
  const { count } = await supabase.from("signatures").select("id", { count: "exact", head: true });
  const { error } = await supabase
    .from("signatures")
    .insert({ name: name.trim().slice(0, 80) || "Signature", path, is_default: !count });
  if (error) throw new Error(error.message);
  revalidatePath("/account");
}

export async function setDefaultSignature(id: string) {
  const supabase = await adminClient();
  const { error: e1 } = await supabase.from("signatures").update({ is_default: false }).eq("is_default", true);
  if (e1) throw new Error(e1.message);
  const { error: e2 } = await supabase.from("signatures").update({ is_default: true }).eq("id", id);
  if (e2) throw new Error(e2.message);
  revalidatePath("/account");
}

export async function deleteSignature(id: string) {
  const supabase = await adminClient();
  const { data: row } = await supabase.from("signatures").select("path").eq("id", id).maybeSingle();
  const { error } = await supabase.from("signatures").delete().eq("id", id);
  if (error) throw new Error(error.message);
  if (row?.path) await supabase.storage.from("files").remove([row.path]);
  revalidatePath("/account");
}
