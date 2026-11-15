import { createClient } from "@/lib/supabase/server";

export async function logAudit(action: string, entity: string, name?: string | null) {
  const supabase = await createClient();
  await supabase.from("audit_log").insert({ action, entity, entity_name: name ?? null });
}
