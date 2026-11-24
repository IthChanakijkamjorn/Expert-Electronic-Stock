import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";
import { GoodsReceiptForm } from "./GoodsReceiptForm";

export default async function NewGoodsReceiptPage() {
  const role = await getRole();
  if (role !== "admin" && role !== "manager") redirect("/");
  const { t } = await getDictionary();
  const supabase = await createClient();
  const [{ data: products }] = await Promise.all([
    supabase.from("product_stock").select("id, name, model, brand, stock, unit").eq("active", true).order("name").limit(2000),
  ]);
  return (
    <section className="flex flex-col gap-6">
      <h1 className="page-title">{t.newGoodsReceipt}</h1>
      <GoodsReceiptForm t={t} products={products ?? []} />
    </section>
  );
}
