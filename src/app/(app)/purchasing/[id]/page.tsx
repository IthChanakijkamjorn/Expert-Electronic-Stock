import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";
import { AddForm } from "@/components/AddForm";
import { ProductPicker } from "../../movements/ProductPicker";
import { cancelOrder, markOrdered, receiveOrder, removePoLine, setPoLine } from "../actions";

export default async function PurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { lang, t } = await getDictionary();
  const role = await getRole();
  if (role !== "admin" && role !== "manager") redirect("/");
  const supabase = await createClient();

  const { data: po } = await supabase
    .from("purchase_orders")
    .select("id, number, status, notes, created_at, received_at, suppliers(name), locations(name)")
    .eq("id", id)
    .maybeSingle();
  if (!po) notFound();

  const [{ data: lines }, { data: products }, { data: locations }] = await Promise.all([
    supabase
      .from("purchase_order_lines")
      .select("id, qty, unit_cost, products(name, sku, unit)")
      .eq("po_id", id)
      .order("id"),
    po.status === "draft"
      ? supabase.from("product_stock").select("id, name, sku, brand, stock, unit").eq("active", true).order("name").limit(1000)
      : Promise.resolve({ data: [] }),
    po.status === "ordered"
      ? supabase.from("locations").select("id, name, is_default").order("name")
      : Promise.resolve({ data: [] }),
  ]);
  const locale = lang === "th" ? "th-TH" : "en-GB";
  const money = (n: number) => n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const total = (lines ?? []).reduce((s, l) => s + l.qty * Number(l.unit_cost), 0);
  const supplier = (po.suppliers as unknown as { name: string } | null)?.name;
  const where = (po.locations as unknown as { name: string } | null)?.name;
  const defaultLoc = locations?.find((l) => l.is_default)?.id;

  return (
    <section className="flex flex-col gap-6">
      <div>
        <Link href="/purchasing" className="text-sm text-muted hover:underline">{t.back}</Link>
        <p className="eyebrow mt-3">{supplier}</p>
        <h1 className="text-3xl font-semibold">
          {po.number} <span className="pill ml-2 bg-[#f5f5ff] text-navy">{t.poStatus[po.status as keyof typeof t.poStatus]}</span>
        </h1>
        {po.notes && <p className="mt-2 text-muted">{po.notes}</p>}
        {po.status === "received" && (
          <p className="mt-2 text-sm text-muted">
            {t.receivedInto} {where} · {po.received_at && new Date(po.received_at).toLocaleString(locale)}
          </p>
        )}
      </div>

      <div className="card overflow-x-auto p-4">
        {lines?.length ? (
          <table className="data-table w-full text-left text-sm">
            <thead>
              <tr>
                <th className="py-2 pr-3">{t.product}</th>
                <th className="pr-3 text-right">{t.quantity}</th>
                <th className="pr-3 text-right">{t.unitCost}</th>
                <th className="text-right">{t.total}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const p = l.products as unknown as { name: string; sku: string | null; unit: string };
                return (
                  <tr key={l.id} className="border-t border-zinc-100">
                    <td className="py-2 pr-3">{p.name}</td>
                    <td className="pr-3 text-right">{l.qty} {p.unit}</td>
                    <td className="pr-3 text-right">{money(Number(l.unit_cost))}</td>
                    <td className="text-right">{money(l.qty * Number(l.unit_cost))}</td>
                    <td className="text-right">
                      {po.status === "draft" && (
                        <form action={removePoLine.bind(null, id, l.id)}>
                          <button className="text-red-600 underline">{t.remove}</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-zinc-300 font-semibold">
                <td colSpan={3} className="py-2 pr-3 text-right">{t.total}</td>
                <td className="text-right">{money(total)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        ) : (
          <p className="text-muted">{t.noItems}</p>
        )}
      </div>

      {po.status === "draft" && (
        <>
          <h2 className="text-xl font-semibold text-navy">{t.addPoLine}</h2>
          <AddForm action={setPoLine.bind(null, id)} submitLabel={t.save}>
            <ProductPicker products={products ?? []} placeholder={t.searchProducts} emptyText={t.noMatches} />
            <input name="qty" type="number" min={1} required className="input" placeholder={t.quantity} />
            <input name="unit_cost" type="number" min={0} step="0.01" required className="input" placeholder={t.unitCost} />
          </AddForm>
          <div className="flex gap-3">
            {!!lines?.length && (
              <form action={markOrdered.bind(null, id)}><button className="btn">{t.markOrdered}</button></form>
            )}
            <form action={cancelOrder.bind(null, id)}><button className="btn-ghost">{t.cancelOrder}</button></form>
          </div>
        </>
      )}

      {po.status === "ordered" && (
        <div className="flex flex-wrap items-end gap-4">
          <form action={receiveOrder.bind(null, id)} className="card flex flex-wrap items-end gap-3 p-4">
            <label className="text-sm">
              {t.receiveInto}
              <select name="location_id" className="input mt-1" defaultValue={defaultLoc}>
                {(locations ?? []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </label>
            <button className="btn">{t.receiveOrder}</button>
          </form>
          <form action={cancelOrder.bind(null, id)}><button className="btn-ghost">{t.cancelOrder}</button></form>
        </div>
      )}
    </section>
  );
}
