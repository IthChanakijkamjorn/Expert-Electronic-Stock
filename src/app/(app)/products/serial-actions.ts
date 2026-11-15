"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addSerials(productId: string, formData: FormData) {
  const serials = [
    ...new Set(
      String(formData.get("serials") ?? "")
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
  if (!serials.length) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("product_serials")
    .upsert(
      serials.map((serial) => ({ product_id: productId, serial })),
      { onConflict: "product_id,serial", ignoreDuplicates: true },
    );
  if (error) throw new Error(error.message);
  revalidatePath(`/products/${productId}`);
}

export async function issueSerial(productId: string, serialId: string, formData: FormData) {
  const issuedTo = String(formData.get("issued_to") ?? "").trim() || null;
  const supabase = await createClient();
  await supabase
    .from("product_serials")
    .update({ status: "issued", issued_to: issuedTo, updated_at: new Date().toISOString() })
    .eq("id", serialId);
  revalidatePath(`/products/${productId}`);
}

export async function returnSerial(productId: string, serialId: string) {
  const supabase = await createClient();
  await supabase
    .from("product_serials")
    .update({ status: "in_stock", issued_to: null, updated_at: new Date().toISOString() })
    .eq("id", serialId);
  revalidatePath(`/products/${productId}`);
}

export async function deleteSerial(productId: string, serialId: string) {
  const supabase = await createClient();
  await supabase.from("product_serials").delete().eq("id", serialId);
  revalidatePath(`/products/${productId}`);
}
