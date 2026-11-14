import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";

export default async function Dashboard() {
  const { t } = await getDictionary();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user!.id)
    .single();

  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">{t.dashboard}</h1>
      <p>
        {t.welcome} {profile?.full_name || user!.email}
        {profile && ` · ${t.role}: ${t.roles[profile.role as keyof typeof t.roles]}`}
      </p>
      <p className="text-zinc-500">{t.comingSoon}</p>
    </section>
  );
}
