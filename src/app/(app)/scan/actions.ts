"use server";

import { createClient } from "@/lib/supabase/server";

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// A scan is either one of our QR labels (a product URL) or a barcode that matches a SKU.
export async function resolveScan(raw: string): Promise<string | null> {
  const text = raw.trim();
  if (!text) return null;
  const supabase = await createClient();
  const m = text.match(/\/products\/([0-9a-f-]{36})/i);
  if (m && UUID.test(m[1])) {
    const { data } = await supabase.from("products").select("id").eq("id", m[1]).maybeSingle();
    if (data) return data.id;
  }
  const { data } = await supabase.from("products").select("id").ilike("sku", text.replace(/[%_\\]/g, "\\$&")).limit(1);
  return data?.[0]?.id ?? null;
}
