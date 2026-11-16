import { createClient } from "@/lib/supabase/server";
import { csvResponse, toCsv } from "@/lib/csv";

export async function GET(req: Request) {
  const low = new URL(req.url).searchParams.has("low");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_stock").select("sku, name, brand, unit, min_stock, stock")
    .eq("active", true).order("brand").order("name").limit(10000);
  if (error) return new Response("forbidden", { status: 403 });
  const rows = (data ?? []).filter((p) => !low || p.stock <= p.min_stock);
  return csvResponse(
    low ? "low-stock.csv" : "products.csv",
    toCsv([["SKU", "Name", "Brand", "Unit", "Min stock", "Stock"], ...rows.map((p) => [p.sku, p.name, p.brand, p.unit, p.min_stock, p.stock])]),
  );
}
