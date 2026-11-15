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
    options: { captchaToken: String(formData.get("captcha") ?? "") || undefined },
  });
  if (error) return { error: true };
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") redirect("/login/mfa");
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function verifyLoginCode(
  _prev: { error: boolean } | null,
  formData: FormData,
) {
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  const factor = data?.totp.find((f) => f.status === "verified");
  if (!factor) redirect("/");
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code: String(formData.get("code") ?? "").trim(),
  });
  if (error) return { error: true };
  redirect("/");
}
