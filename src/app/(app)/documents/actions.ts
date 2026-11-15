"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const TABLES = { invoices: "tax_invoices", quotations: "quotations", receipts: "receipts" } as const;

// Only drafts can be deleted; finalized documents are never removed.
export async function deleteDraft(kind: keyof typeof TABLES, id: string) {
  const supabase = await createClient();
  await supabase.from(TABLES[kind]).delete().eq("id", id).eq("status", "draft");
  revalidatePath(`/${kind}`);
  revalidatePath("/documents");
}
