import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { verifiedTotpFactor } from "@/lib/mfa";

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
  const negCount = (stock ?? []).filter((p) => p.stock < 0).length;
  const lowCount = (stock ?? []).filter((p) => p.stock <= p.min_stock).length;

  const needs2fa = profile?.role === "admin" && !(await verifiedTotpFactor());

  const manager = profile?.role === "admin" || profile?.role === "manager";
  const groups = [
    {
      title: t.navStock,
      items: [
        { href: "/products", label: t.products },
        { href: "/movements", label: t.movements },
        { href: "/low-stock", label: t.lowStock },
        { href: "/scan", label: t.scan },
        ...(manager ? [{ href: "/stocktake", label: t.stocktake }, { href: "/locations", label: t.locations }] : []),
      ],
    },
    {
      title: t.documents,
      items: [
        { href: "/invoices", label: t.taxInvoices, note: t.docStockLinked },
        ...(manager
          ? [
              { href: "/quotations", label: t.quotation, note: t.docNotStock },
              { href: "/receipts", label: t.receipt, note: t.docNotStock },
            ]
          : []),
      ],
    },
    {
      title: t.projects,
      items: [
        { href: "/projects", label: t.projects },
        { href: "/floorplans", label: t.floorPlans },
      ],
    },
    ...(manager
      ? [{ title: t.purchasing, items: [{ href: "/purchasing", label: t.purchasing }, { href: "/suppliers", label: t.suppliers }] }]
      : []),
    ...(profile?.role === "admin"
      ? [{ title: t.navAdmin, items: [{ href: "/users", label: t.users }, { href: "/audit", label: t.auditLog }] }]
      : []),
    { title: t.account, items: [{ href: "/account", label: t.account }] },
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
      {needs2fa && (
        <Link href="/account" className="card card-link !border-amber-300 !bg-amber-50 font-semibold text-amber-800">
          🔐 {t.admin2faReminder}
        </Link>
      )}
      {negCount > 0 && (
        <Link href="/low-stock" className="card card-link flex items-center justify-between gap-3 !border-red-300 !bg-red-50 text-lg font-semibold text-red-800">
          🔴 {t.negativeStockTitle}: {negCount}
          <span className="arrow-chip">→</span>
        </Link>
      )}
      {lowCount > 0 && (
        <Link href="/low-stock" className="card card-link flex items-center justify-between gap-3 !border-amber-300 !bg-amber-50 text-lg font-semibold text-amber-800">
          ⚠ {t.lowStockTitle}: {lowCount}
          <span className="arrow-chip">→</span>
        </Link>
      )}
      {groups.map((g) => (
        <div key={g.title}>
          <h2 className="mb-3 text-xl font-semibold">{g.title}</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {g.items.map((d) => (
              <Link key={d.href} href={d.href} className="card card-link flex flex-col gap-1 text-navy">
                <span className="flex items-center justify-between gap-3 text-xl font-semibold">
                  {d.label}
                  <span className="arrow-chip">→</span>
                </span>
                {"note" in d && <span className="text-sm text-muted">{d.note}</span>}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
