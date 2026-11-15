import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";
import { AddForm } from "@/components/AddForm";
import { RenameForm } from "@/components/RenameForm";
import { createLocation, renameLocation } from "./actions";

export default async function LocationsPage() {
  const { t } = await getDictionary();
  const role = await getRole();
  if (role !== "admin" && role !== "manager") redirect("/");
  const supabase = await createClient();
  const { data: locations } = await supabase
    .from("locations")
    .select("id, name, is_default")
    .order("name");
  const labels = { rename: t.rename, save: t.save, cancel: t.cancel, failed: t.saveFailed };

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold">{t.locations}</h1>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div className="card p-4">
          <ul className="divide-y divide-[#ece8f2]">
            {(locations ?? []).map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="font-semibold text-navy">
                  {l.name}
                  {l.is_default && <span className="pill ml-2 bg-[#f5f5ff] text-navy">{t.defaultLocation}</span>}
                </span>
                <RenameForm initial={l.name} action={renameLocation.bind(null, l.id)} labels={labels} />
              </li>
            ))}
          </ul>
        </div>
        <AddForm action={createLocation} submitLabel={t.addLocation}>
          <input name="name" required className="input" placeholder={t.locationName} />
        </AddForm>
      </div>
    </section>
  );
}
