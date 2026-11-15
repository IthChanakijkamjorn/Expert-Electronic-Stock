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

  const { data: stock } = await supabase.from("product_stock").select("stock, min_stock").eq("active", true).limit(5000);
  const lowCount = (stock ?? []).filter((p) => p.stock <= p.min_stock).length;

  const links = [
    { href: "/products", label: t.products },
    { href: "/movements", label: t.movements },
    { href: "/projects", label: t.projects },
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
      {lowCount > 0 && (
        <Link href="/low-stock" className="card card-link flex items-center justify-between gap-3 !border-amber-300 !bg-amber-50 text-lg font-semibold text-amber-800">
          ⚠ {t.lowStockTitle}: {lowCount}
          <span className="arrow-chip">→</span>
        </Link>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="card card-link flex items-center justify-between gap-3 text-xl font-semibold text-navy">
            {l.label}
            <span className="arrow-chip">→</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
