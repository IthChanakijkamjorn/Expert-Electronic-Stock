"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;

export async function createOrganization(formData: FormData) {
  const name = text(formData, "name");
  if (!name) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .insert({ name, image_path: text(formData, "image_path") });
  if (error) throw new Error(error.message);
  revalidatePath("/projects", "layout");
}

export async function createTower(orgId: string, formData: FormData) {
  const name = text(formData, "name");
  if (!name) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("towers")
    .insert({ organization_id: orgId, name, image_path: text(formData, "image_path") });
  if (error) throw new Error(error.message);
  revalidatePath("/projects", "layout");
}

export async function createProject(orgId: string, towerId: string, formData: FormData) {
  const name = text(formData, "name");
  const year = Math.floor(Number(formData.get("year")));
  if (!name || !year) return;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({ tower_id: towerId, name, year, notes: text(formData, "notes") })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  redirect(`/projects/${orgId}/${towerId}/${data.id}`);
}

export async function addProjectFile(
  projectId: string,
  path: string,
  name: string,
  size: number,
) {
  // Only accept objects that live under this project's folder.
  if (!path.startsWith(`projects/${projectId}/`)) throw new Error("bad path");
  const supabase = await createClient();
  const { error } = await supabase
    .from("project_files")
    .insert({ project_id: projectId, storage_path: path, file_name: name, size_bytes: size });
  if (error) throw new Error(error.message);
}

export async function deleteProjectFile(fileId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("project_files")
    .select("storage_path")
    .eq("id", fileId)
    .single();
  if (!data) return;
  await supabase.storage.from("files").remove([data.storage_path]);
  await supabase.from("project_files").delete().eq("id", fileId);
  revalidatePath("/projects", "layout");
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };
  if (data?.role !== "admin") throw new Error("admin only");
  return supabase;
}

export async function deleteProject(orgId: string, towerId: string, projectId: string) {
  const supabase = await requireAdmin();
  const { data: files } = await supabase
    .from("project_files")
    .select("storage_path")
    .eq("project_id", projectId);
  const paths = (files ?? []).map((f) => f.storage_path);
  if (paths.length) {
    await supabase.storage.from("files").remove(paths);
    await supabase
      .from("file_shares")
      .update({ revoked_at: new Date().toISOString() })
      .in("storage_path", paths);
  }
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) throw new Error(error.message);
  revalidatePath("/projects", "layout");
  redirect(`/projects/${orgId}/${towerId}`);
}
