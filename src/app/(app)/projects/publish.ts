"use server";

import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/role";

const PID = "q1vklck6";
const DATASET = "production";
const API = "2024-01-01";

function token() {
  const t = process.env.SANITY_WRITE_TOKEN;
  if (!t) throw new Error("SANITY_WRITE_TOKEN is not set");
  return t;
}

async function guard() {
  const role = await getRole();
  if (role !== "admin" && role !== "manager") throw new Error("forbidden");
}

const mutate = (mutations: unknown[]) =>
  fetch(`https://${PID}.api.sanity.io/v${API}/data/mutate/${DATASET}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ mutations }),
  });

// Sends the chosen photos to the public website's Sanity project. Re-publishing replaces the same document.
export async function publishProject(projectId: string, photoIds: string[], location: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await guard();
    if (!photoIds.length) return { ok: false, error: "no photos" };
    const supabase = await createClient();
    const { data: project } = await supabase.from("projects").select("name, year").eq("id", projectId).single();
    const { data: photos } = await supabase.from("project_photos").select("id, storage_path").in("id", photoIds);
    if (!project || !photos?.length) return { ok: false, error: "not found" };
    const ordered = photoIds.map((id) => photos.find((p) => p.id === id)).filter(Boolean) as typeof photos;

    const { data: signed } = await supabase.storage.from("files").createSignedUrls(ordered.map((p) => p.storage_path), 300);
    const images: unknown[] = [];
    for (const s of signed ?? []) {
      if (!s.signedUrl) continue;
      const img = await fetch(s.signedUrl);
      if (!img.ok) continue;
      const up = await fetch(`https://${PID}.api.sanity.io/v${API}/assets/images/${DATASET}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}`, "Content-Type": img.headers.get("content-type") ?? "image/jpeg" },
        body: Buffer.from(await img.arrayBuffer()),
      });
      if (!up.ok) return { ok: false, error: `asset upload ${up.status}` };
      const { document } = (await up.json()) as { document: { _id: string } };
      images.push({ _type: "image", _key: crypto.randomUUID().slice(0, 12), asset: { _type: "reference", _ref: document._id } });
    }
    const res = await mutate([
      {
        createOrReplace: {
          _id: `backoffice-${projectId}`,
          _type: "project",
          title: project.name,
          year: project.year,
          location: location.trim() || undefined,
          images,
        },
      },
    ]);
    if (!res.ok) return { ok: false, error: `sanity ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "error" };
  }
}

export async function unpublishProject(projectId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await guard();
    const res = await mutate([{ delete: { id: `backoffice-${projectId}` } }]);
    return res.ok ? { ok: true } : { ok: false, error: `sanity ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "error" };
  }
}
