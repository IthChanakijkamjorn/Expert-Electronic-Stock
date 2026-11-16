import { createClient } from "@/lib/supabase/server";
import { mergeDocCompany, type DocCompany, type DocKind } from "@/lib/company";

export async function loadCompanyDefault(kind: DocKind): Promise<DocCompany> {
  const supabase = await createClient();
  const { data } = await supabase.from("company_defaults").select("company").eq("kind", kind).maybeSingle();
  return mergeDocCompany(data?.company as Partial<DocCompany> | null, kind);
}
