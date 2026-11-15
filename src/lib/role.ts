import { createClient } from "@/lib/supabase/server";

export async function getRole() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return null;
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  return (data?.role ?? null) as "admin" | "manager" | "staff" | null;
}
