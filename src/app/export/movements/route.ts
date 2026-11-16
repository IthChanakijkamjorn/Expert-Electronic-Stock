import { createClient } from "@/lib/supabase/server";
import { csvResponse, toCsv } from "@/lib/csv";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_movements").select("created_at, quantity, type, comment, created_by, products(name, sku, brand)")
    .order("created_at", { ascending: false }).limit(50000);
  if (error) return new Response("forbidden", { status: 403 });
  const ids = [...new Set((data ?? []).map((m) => m.created_by))];
  const { data: people } = ids.length ? await supabase.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
  const names = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  return csvResponse(
    "movements.csv",
    toCsv([
      ["Date", "SKU", "Product", "Brand", "Quantity", "Reason", "Comment", "By"],
      ...(data ?? []).map((m) => {
        const p = m.products as unknown as { name: string; sku: string | null; brand: string | null } | null;
        return [m.created_at, p?.sku, p?.name, p?.brand, m.quantity, m.type, m.comment, names.get(m.created_by)];
      }),
    ]),
  );
}
