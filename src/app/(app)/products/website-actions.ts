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
