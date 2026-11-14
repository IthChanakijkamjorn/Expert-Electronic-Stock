"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const USERNAME_DOMAIN = "expertelectronic.co.th";

export async function signIn(
  _prev: { error: boolean } | null,
  formData: FormData,
) {
  const supabase = await createClient();
  const id = String(formData.get("email") ?? "").trim().toLowerCase();
  // Usernames map to an email on the company domain; full emails still work.
  const { error } = await supabase.auth.signInWithPassword({
    email: id.includes("@") ? id : `${id}@${USERNAME_DOMAIN}`,
    password: String(formData.get("password") ?? ""),
  });
  if (error) return { error: true };
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
