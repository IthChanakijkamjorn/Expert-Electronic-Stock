"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { effectivePassword } from "@/lib/pin";

const USERNAME_DOMAIN = "expertelectronic.co.th";

export async function signIn(
  _prev: { error: boolean } | null,
  formData: FormData,
) {
  const supabase = await createClient();
  const id = String(formData.get("email") ?? "").trim().toLowerCase();
  // Usernames map to an email on the company domain; full emails still work.
  const email = id.includes("@") ? id : `${id}@${USERNAME_DOMAIN}`;
  const admin = adminClient();
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const { count } = await admin.from("login_attempts").select("id", { count: "exact", head: true }).eq("identifier", email).gte("at", since);
  if ((count ?? 0) >= 5) return { error: true };
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: effectivePassword(String(formData.get("password") ?? "")),
    options: { captchaToken: String(formData.get("captcha") ?? "") || undefined },
  });
  if (error) {
    await admin.from("login_attempts").insert({ identifier: email });
    return { error: true };
  }
  await admin.from("login_attempts").delete().eq("identifier", email);
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
