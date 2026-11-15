"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/role";
import { cleanPlanData } from "@/lib/floorplan";

export type PlanState = { error?: "invalid" | "failed"; ok?: boolean } | null;

const dim = (v: FormDataEntryValue | null) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n <= 500 ? Math.round(n * 100) / 100 : NaN;
};

export async function savePlan(id: string | null, _prev: PlanState, formData: FormData): Promise<PlanState> {
  const role = await getRole();
  if (role !== "admin" && role !== "manager") return { error: "failed" };
  const name = String(formData.get("name") ?? "").trim();
  const width = dim(formData.get("width_m"));
  const height = dim(formData.get("height_m"));
  let data;
  try {
    data = cleanPlanData(JSON.parse(String(formData.get("data") ?? "{}")), width, height);
  } catch {
    return { error: "invalid" };
  }
  if (!name || Number.isNaN(width) || Number.isNaN(height)) return { error: "invalid" };
  const project_id = String(formData.get("project_id") ?? "") || null;

  const supabase = await createClient();
  if (id) {
    const { error } = await supabase
      .from("floor_plans")
      .update({ name, width_m: width, height_m: height, project_id, data, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { error: "failed" };
    revalidatePath("/floorplans");
    return { ok: true };
  }
  const { data: created, error } = await supabase
    .from("floor_plans")
    .insert({ name, width_m: width, height_m: height, project_id, data })
    .select("id")
    .single();
  if (error || !created) return { error: "failed" };
  revalidatePath("/floorplans");
  redirect(`/floorplans/${created.id}`);
}

export async function deletePlan(id: string) {
  const role = await getRole();
  if (role !== "admin" && role !== "manager") return;
  const supabase = await createClient();
  await supabase.from("floor_plans").delete().eq("id", id);
  revalidatePath("/floorplans");
  redirect("/floorplans");
}
