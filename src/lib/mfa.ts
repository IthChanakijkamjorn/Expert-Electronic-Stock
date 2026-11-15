import { createClient } from "@/lib/supabase/server";

export async function verifiedTotpFactor() {
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  return data?.totp.find((f) => f.status === "verified") ?? null;
}
