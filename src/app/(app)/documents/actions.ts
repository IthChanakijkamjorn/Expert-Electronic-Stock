"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DocCompany, DocKind } from "@/lib/company";

const TABLES = { invoices: "tax_invoices", quotations: "quotations", receipts: "receipts" } as const;

export async function saveCompanyDefault(kind: DocKind, company: DocCompany) {
  const supabase = await createClient();
  await supabase.from("company_defaults").upsert({ kind, company, updated_at: new Date().toISOString() });
}

// Only drafts can be deleted; finalized documents are never removed.
export async function deleteDraft(kind: keyof typeof TABLES, id: string) {
  const supabase = await createClient();
  await supabase.from(TABLES[kind]).delete().eq("id", id).eq("status", "draft");
  revalidatePath(`/${kind}`);
  revalidatePath("/documents");
}

export type Salesperson = { id: string; name: string };

export async function addSalesperson(name: string): Promise<Salesperson | null> {
  const clean = name.trim();
  if (!clean) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("salespeople").insert({ name: clean }).select("id, name").single();
  return data;
}

export async function renameSalesperson(id: string, name: string): Promise<boolean> {
  const clean = name.trim();
  if (!clean) return false;
  const supabase = await createClient();
  const { error } = await supabase.from("salespeople").update({ name: clean }).eq("id", id);
  return !error;
}

export async function deleteSalesperson(id: string) {
  const supabase = await createClient();
  await supabase.from("salespeople").delete().eq("id", id);
}

export async function addCustomer(name: string): Promise<Salesperson | null> {
  const clean = name.trim();
  if (!clean) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("customers").insert({ name: clean }).select("id, name").single();
  return data;
}

export async function renameCustomer(id: string, name: string): Promise<boolean> {
  const clean = name.trim();
  if (!clean) return false;
  const supabase = await createClient();
  const { error } = await supabase.from("customers").update({ name: clean }).eq("id", id);
  return !error;
}

export async function deleteCustomer(id: string) {
  const supabase = await createClient();
  await supabase.from("customers").delete().eq("id", id);
}

export async function addUnit(name: string): Promise<Salesperson | null> {
  const clean = name.trim();
  if (!clean) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("units").insert({ name: clean }).select("id, name").single();
  return data;
}

export async function renameUnit(id: string, name: string): Promise<boolean> {
  const clean = name.trim();
  if (!clean) return false;
  const supabase = await createClient();
  const { error } = await supabase.from("units").update({ name: clean }).eq("id", id);
  return !error;
}

export async function deleteUnit(id: string) {
  const supabase = await createClient();
  await supabase.from("units").delete().eq("id", id);
}

type DocKindName = "invoice" | "quotation" | "receipt";

export async function addDocumentFile(docKind: DocKindName, path: string, name: string, size: number) {
  if (!path.startsWith(`documents/${docKind}/`)) throw new Error("bad path");
  const supabase = await createClient();
  const { error } = await supabase.from("document_files").insert({ doc_kind: docKind, storage_path: path, file_name: name, size_bytes: size });
  if (error) throw new Error(error.message);
}

export async function deleteDocumentFile(fileId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("document_files").select("storage_path").eq("id", fileId).single();
  if (!data) return;
  await supabase.storage.from("files").remove([data.storage_path]);
  await supabase.from("document_files").delete().eq("id", fileId);
  revalidatePath("/documents");
}

export async function addRequester(name: string): Promise<Salesperson | null> {
  const clean = name.trim();
  if (!clean) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("requesters").insert({ name: clean }).select("id, name").single();
  return data;
}

export async function renameRequester(id: string, name: string): Promise<boolean> {
  const clean = name.trim();
  if (!clean) return false;
  const supabase = await createClient();
  const { data: old } = await supabase.from("requesters").select("name").eq("id", id).maybeSingle();
  const { error } = await supabase.from("requesters").update({ name: clean }).eq("id", id);
  if (error) return false;
  if (old?.name) {
    await Promise.all(["quotations", "tax_invoices", "receipts"].map((t) => supabase.from(t).update({ requester: clean }).eq("requester", old.name)));
  }
  return true;
}

export async function deleteRequester(id: string) {
  const supabase = await createClient();
  await supabase.from("requesters").delete().eq("id", id);
}
