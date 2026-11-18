"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

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
    .insert({ tower_id: towerId, name, year, notes: text(formData, "notes"), image_path: text(formData, "image_path") })
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
  kind: "original" | "comparison" = "original",
) {
  // Only accept objects that live under this project's folder.
  if (!path.startsWith(`projects/${projectId}/`)) throw new Error("bad path");
  const supabase = await createClient();
  const { error } = await supabase
    .from("project_files")
    .insert({ project_id: projectId, storage_path: path, file_name: name, size_bytes: size, kind: kind === "comparison" ? "comparison" : "original" });
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

export async function addProjectPhoto(projectId: string, path: string) {
  if (!path.startsWith(`projects/${projectId}/`)) throw new Error("bad path");
  const supabase = await createClient();
  const { error } = await supabase.from("project_photos").insert({ project_id: projectId, storage_path: path });
  if (error) throw new Error(error.message);
  revalidatePath("/projects", "layout");
}

export async function deleteProjectPhoto(photoId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("project_photos").select("storage_path").eq("id", photoId).single();
  if (!data) return;
  await supabase.storage.from("files").remove([data.storage_path]);
  await supabase.from("project_photos").delete().eq("id", photoId);
  revalidatePath("/projects", "layout");
}

export async function setProjectCover(projectId: string, path: string | null) {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").update({ image_path: path }).eq("id", projectId);
  if (error) throw new Error(error.message);
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
  const { data: photos } = await supabase.from("project_photos").select("storage_path").eq("project_id", projectId);
  const { data: proj } = await supabase.from("projects").select("image_path").eq("id", projectId).single();
  const paths = [...(files ?? []).map((f) => f.storage_path), ...(photos ?? []).map((f) => f.storage_path), ...(proj?.image_path ? [proj.image_path] : [])];
  if (paths.length) {
    await supabase.storage.from("files").remove(paths);
    await supabase
      .from("file_shares")
      .update({ revoked_at: new Date().toISOString() })
      .in("storage_path", paths);
  }
  const nm = await nameOf(supabase, "projects", projectId);
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) throw new Error(error.message);
  await logAudit("delete", "project", nm);
  revalidatePath("/projects", "layout");
  redirect(`/projects/${orgId}/${towerId}`);
}

async function nameOf(supabase: Awaited<ReturnType<typeof createClient>>, table: string, id: string) {
  const { data } = await supabase.from(table).select("name").eq("id", id).maybeSingle();
  return (data as { name?: string } | null)?.name ?? id;
}

async function purge(supabase: Awaited<ReturnType<typeof createClient>>, paths: (string | null)[]) {
  const list = paths.filter((p): p is string => !!p);
  if (!list.length) return;
  await supabase.storage.from("files").remove(list);
  await supabase
    .from("file_shares")
    .update({ revoked_at: new Date().toISOString() })
    .in("storage_path", list);
}

type TowerTree = { image_path: string | null; projects: { image_path: string | null; project_files: { storage_path: string }[]; project_photos: { storage_path: string }[] }[] };
const towerPaths = (t: TowerTree) => [
  t.image_path,
  ...t.projects.flatMap((p) => [p.image_path, ...p.project_files.map((f) => f.storage_path), ...p.project_photos.map((f) => f.storage_path)]),
];

export async function deleteTower(orgId: string, towerId: string, stay = false) {
  const supabase = await requireAdmin();
  const { data } = await supabase
    .from("towers")
    .select("image_path, projects(image_path, project_files(storage_path), project_photos(storage_path))")
    .eq("id", towerId)
    .single();
  if (data) await purge(supabase, towerPaths(data as unknown as TowerTree));
  const nm = await nameOf(supabase, "towers", towerId);
  const { error } = await supabase.from("towers").delete().eq("id", towerId);
  if (error) throw new Error(error.message);
  await logAudit("delete", "tower", nm);
  revalidatePath("/projects", "layout");
  if (!stay) redirect(`/projects/${orgId}`);
}

export async function deleteOrganization(orgId: string, stay = false) {
  const supabase = await requireAdmin();
  const { data } = await supabase
    .from("organizations")
    .select("image_path, towers(image_path, projects(image_path, project_files(storage_path), project_photos(storage_path)))")
    .eq("id", orgId)
    .single();
  if (data) {
    const o = data as unknown as { image_path: string | null; towers: TowerTree[] };
    await purge(supabase, [o.image_path, ...o.towers.flatMap(towerPaths)]);
  }
  const nm = await nameOf(supabase, "organizations", orgId);
  const { error } = await supabase.from("organizations").delete().eq("id", orgId);
  if (error) throw new Error(error.message);
  await logAudit("delete", "organization", nm);
  revalidatePath("/projects", "layout");
  if (!stay) redirect("/projects");
}

const cleanName = (name: string) => {
  const n = name.trim();
  if (!n) throw new Error("empty name");
  return n;
};

export async function renameOrganization(id: string, name: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("organizations").update({ name: cleanName(name) }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/projects", "layout");
}

export async function renameTower(id: string, name: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("towers").update({ name: cleanName(name) }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/projects", "layout");
}

export async function renameProject(id: string, name: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").update({ name: cleanName(name) }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/projects", "layout");
}

export async function reorderOrganizations(ids: string[]) {
  const supabase = await createClient();
  const results = await Promise.all(
    ids.map((id, i) => supabase.from("organizations").update({ position: i }).eq("id", id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
  revalidatePath("/projects", "layout");
}

export async function reorderTowers(ids: string[]) {
  const supabase = await createClient();
  const results = await Promise.all(
    ids.map((id, i) => supabase.from("towers").update({ position: i }).eq("id", id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
  revalidatePath("/projects", "layout");
}

export async function deleteOrganizationInline(orgId: string) {
  return deleteOrganization(orgId, true);
}
export async function deleteTowerInline(orgId: string, towerId: string) {
  return deleteTower(orgId, towerId, true);
}

export async function setProjectItem(projectId: string, formData: FormData) {
  const productId = text(formData, "product_id");
  const qty = Math.floor(Number(formData.get("planned_qty")));
  if (!productId || !(qty > 0)) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("project_items")
    .upsert({ project_id: projectId, product_id: productId, planned_qty: qty }, { onConflict: "project_id,product_id" });
  if (error) throw new Error(error.message);
  revalidatePath("/projects", "layout");
}

export async function removeProjectItem(itemId: string) {
  const supabase = await createClient();
  await supabase.from("project_items").delete().eq("id", itemId);
  revalidatePath("/projects", "layout");
}
