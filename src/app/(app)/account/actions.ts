"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function startEnroll() {
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  // Drop abandoned enrolments so a new one can start.
  for (const f of factors?.all ?? []) {
    if (f.factor_type === "totp" && f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
  if (error || !data) return null;
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

export async function confirmEnroll(factorId: string, code: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
  if (error) return false;
  revalidatePath("/", "layout");
  return true;
}

export async function disableTwoFactor(factorId: string) {
  const supabase = await createClient();
  await supabase.auth.mfa.unenroll({ factorId });
  revalidatePath("/", "layout");
}
