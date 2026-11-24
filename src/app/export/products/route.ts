import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/fetchAll";
import { xlsxResponse } from "@/lib/excel";
import { productsXlsx } from "@/lib/productSheet";
import { unitLabel } from "@/lib/unit";
import { fileNameOf, type SpecTab } from "@/lib/website";

// Same layout as the import template, so the file can be edited and imported back.
export async function GET(req: Request) {
  const low = new URL(req.url).searchParams.has("low");
  const supabase = await createClient();
  const { error } = await supabase.from("products").select("id").limit(1);
  if (error) return new Response("forbidden", { status: 403 });
  const products = await fetchAll((from, to) =>
    supabase
      .from("products")
      .select("id, brand, model, name, category, sub_category, description, image_path, website_datasheet_id, unit, on_website, at_a_glance, specifications")
      .eq("active", true).order("brand").order("name").range(from, to),
  );
  const stock = await fetchAll((from, to) => supabase.from("product_stock").select("id, stock").eq("active", true).order("id").range(from, to));
  const qty = new Map(stock.map((s) => [s.id, s.stock as number]));
  const sheetIds = products.map((p) => p.website_datasheet_id).filter(Boolean) as string[];
  const sheets = new Map<string, string>();
  for (let i = 0; i < sheetIds.length; i += 200) {
    const { data } = await supabase.from("product_files").select("id, file_name").in("id", sheetIds.slice(i, i + 200));
    data?.forEach((f) => sheets.set(f.id, f.file_name));
  }

  const rows = products
    .filter((p) => !low || (qty.get(p.id) ?? 0) < 5)
    .map((p) => ({
      brand: p.brand,
      model: p.model,
      name: p.name,
      category: p.category,
      subCategory: p.sub_category,
      description: p.description,
      image: p.image_path ? fileNameOf(p.image_path) : null,
      datasheet: p.website_datasheet_id ? sheets.get(p.website_datasheet_id) ?? null : null,
      quantity: qty.get(p.id) ?? 0,
      unit: unitLabel(p.unit),
      website: p.on_website,
      atAGlance: p.at_a_glance,
      specifications: p.specifications as SpecTab[] | null,
    }));
  return xlsxResponse(await productsXlsx(rows), low ? "low-stock" : "products");
}
