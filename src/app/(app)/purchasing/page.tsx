import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";
import { AddForm } from "@/components/AddForm";
import { createPurchaseOrder } from "./actions";

export default async function PurchasingPage() {
  const { lang, t } = await getDictionary();
  const role = await getRole();
  if (role !== "admin" && role !== "manager") redirect("/");
  const supabase = await createClient();
  const [{ data: orders }, { data: suppliers }, { data: lines }] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select("id, number, status, created_at, suppliers(name)")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("suppliers").select("id, name").order("name"),
    supabase.from("purchase_order_lines").select("po_id, qty, unit_cost").limit(10000),
  ]);
  const totals = new Map<string, number>();
  (lines ?? []).forEach((l) => totals.set(l.po_id, (totals.get(l.po_id) ?? 0) + l.qty * Number(l.unit_cost)));
  const money = (n: number) => n.toLocaleString(lang === "th" ? "th-TH" : "en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const statusClass: Record<string, string> = {
    draft: "bg-zinc-100 text-zinc-700",
    ordered: "bg-amber-100 text-amber-700",
    received: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-red-100 text-red-700",
  };

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">{t.purchasing}</h1>
        <Link href="/suppliers" className="btn-ghost">{t.suppliers}</Link>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div className="card overflow-x-auto p-4">
          {orders?.length ? (
            <table className="data-table w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="py-2 pr-3">{t.poNumber}</th>
                  <th className="pr-3">{t.supplier}</th>
                  <th className="pr-3">{t.date}</th>
                  <th className="pr-3">{t.status}</th>
                  <th className="text-right">{t.total}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-zinc-100">
                    <td className="py-2 pr-3">
                      <Link href={`/purchasing/${o.id}`} className="font-semibold text-navy underline">{o.number}</Link>
                    </td>
                    <td className="pr-3">{(o.suppliers as unknown as { name: string } | null)?.name}</td>
                    <td className="pr-3">{new Date(o.created_at).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB")}</td>
                    <td className="pr-3"><span className={`pill ${statusClass[o.status]}`}>{t.poStatus[o.status as keyof typeof t.poStatus]}</span></td>
                    <td className="text-right">{money(totals.get(o.id) ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-muted">{t.noItems}</p>
          )}
        </div>
        {suppliers?.length ? (
          <AddForm action={createPurchaseOrder} submitLabel={t.newPo}>
            <select name="supplier_id" required className="input" defaultValue="">
              <option value="" disabled>{t.supplier}</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <textarea name="notes" rows={2} className="input" placeholder={t.notes} />
          </AddForm>
        ) : (
          <p className="text-muted">{t.addSupplierFirst}</p>
        )}
      </div>
    </section>
  );
}
