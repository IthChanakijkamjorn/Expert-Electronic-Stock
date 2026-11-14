import Link from "next/link";
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

  const links = [
    { href: "/products", label: t.products },
    { href: "/movements", label: t.movements },
    { href: "/projects", label: t.projects },
    { href: "/files", label: t.filesMenu },
  ];
  return (
    <section className="flex flex-col gap-6">
      <div>
        <p className="eyebrow">{t.dashboard}</p>
        <h1 className="mt-2 text-4xl font-bold">
          {t.welcome} {profile?.full_name || user!.email}
        </h1>
        {profile && (
          <p className="mt-2 text-muted">
            {t.role}: {t.roles[profile.role as keyof typeof t.roles]}
          </p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="card text-xl font-semibold text-navy transition hover:-translate-y-0.5">
            {l.label} →
          </Link>
        ))}
      </div>
    </section>
  );
}
