"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/role";

export async function setSignature(path: string) {
  if ((await getRole()) !== "admin") throw new Error("forbidden");
  if (!path.startsWith("images/signature/")) throw new Error("bad path");
  const supabase = await createClient();
  const { data: old } = await supabase.from("company_settings").select("value").eq("key", "signature").maybeSingle();
  const { error } = await supabase.from("company_settings").upsert({ key: "signature", value: path });
  if (error) throw new Error(error.message);
  if (old?.value) await supabase.storage.from("files").remove([old.value]);
  revalidatePath("/account");
}

export async function removeSignature() {
  if ((await getRole()) !== "admin") throw new Error("forbidden");
  const supabase = await createClient();
  const { data: old } = await supabase.from("company_settings").select("value").eq("key", "signature").maybeSingle();
  await supabase.from("company_settings").delete().eq("key", "signature");
  if (old?.value) await supabase.storage.from("files").remove([old.value]);
  revalidatePath("/account");
}
