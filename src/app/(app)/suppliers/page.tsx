import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";
import { AddForm } from "@/components/AddForm";
import { RenameForm } from "@/components/RenameForm";
import { createSupplier, renameSupplier } from "./actions";

export default async function SuppliersPage() {
  const { t } = await getDictionary();
  const role = await getRole();
  if (role !== "admin" && role !== "manager") redirect("/");
  const supabase = await createClient();
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, name, contact, phone, email, notes")
    .order("name");
  const labels = { rename: t.rename, save: t.save, cancel: t.cancel, failed: t.saveFailed };

  return (
    <section className="flex flex-col gap-6">
      <div>
        <Link href="/purchasing" className="text-sm text-muted hover:underline">{t.back}</Link>
        <h1 className="mt-2 text-3xl font-semibold">{t.suppliers}</h1>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div className="card p-4">
          {suppliers?.length ? (
            <ul className="divide-y divide-[#ece8f2]">
              {suppliers.map((s) => (
                <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div>
                    <p className="font-semibold text-navy">{s.name}</p>
                    <p className="text-sm text-muted">
                      {[s.contact, s.phone, s.email].filter(Boolean).join(" · ")}
                    </p>
                    {s.notes && <p className="text-sm">{s.notes}</p>}
                  </div>
                  <RenameForm initial={s.name} action={renameSupplier.bind(null, s.id)} labels={labels} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">{t.noItems}</p>
          )}
        </div>
        <AddForm action={createSupplier} submitLabel={t.addSupplier}>
          <input name="name" required className="input" placeholder={t.supplierName} />
          <input name="contact" className="input" placeholder={t.contactPerson} />
          <input name="phone" className="input" placeholder={t.phone} />
          <input name="email" type="email" className="input" placeholder={t.emailAddress} />
          <textarea name="notes" rows={2} className="input" placeholder={t.notes} />
        </AddForm>
      </div>
    </section>
  );
}
