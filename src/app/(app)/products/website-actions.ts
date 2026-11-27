"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/role";
import { syncProductToWebsite, type WebsiteResult } from "@/lib/website";

async function guard() {
  const role = await getRole();
  if (role !== "admin" && role !== "manager") throw new Error("forbidden");
}

export async function publishProduct(productId: string): Promise<{ result?: WebsiteResult; error?: string }> {
  await guard();
  try {
    return { result: await syncProductToWebsite(await createClient(), productId) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "error" };
  }
}

export async function saveWebsiteSettings(productId: string, formData: FormData) {
  await guard();
  const supabase = await createClient();
  const datasheet = String(formData.get("datasheet") ?? "");
  const { error } = await supabase
    .from("products")
    .update({
      on_website: formData.get("on_website") === "on",
      featured: formData.get("featured") === "on",
      website_datasheet_id: datasheet || null,
    })
    .eq("id", productId);
  if (error) throw new Error(error.message);
  await syncProductToWebsite(supabase, productId);
  revalidatePath(`/products/${productId}`);
}

// One rebuild after a batch of changes. The Sanity webhook must stay off, otherwise every product starts its own deploy.
export async function triggerWebsiteDeploy(): Promise<{ ok: boolean; error?: string }> {
  await guard();
  const url = process.env.WEBSITE_DEPLOY_HOOK_URL;
  if (!url) return { ok: false, error: "WEBSITE_DEPLOY_HOOK_URL is not set" };
  try {
    const res = await fetch(url, { method: "POST" });
    return res.ok ? { ok: true } : { ok: false, error: `deploy hook ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "error" };
  }
}
