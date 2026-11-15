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

  const links = [
    { href: "/products", label: t.products },
    { href: "/movements", label: t.movements },
    { href: "/projects", label: t.projects },
  ];
  const docs = [
    { href: "/invoices", label: t.taxInvoices, note: t.docStockLinked },
    { href: "/quotations", label: t.quotation, note: t.docNotStock },
    { href: "/receipts", label: t.receipt, note: t.docNotStock },
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
      <div className="grid gap-4 sm:grid-cols-3">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="card card-link flex items-center justify-between gap-3 text-xl font-semibold text-navy">
            {l.label}
            <span className="arrow-chip">→</span>
          </Link>
        ))}
      </div>
      <div>
        <h2 className="mb-3 text-xl font-semibold">{t.documents}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {docs.map((d) => (
            <Link key={d.href} href={d.href} className="card card-link flex flex-col gap-1 text-navy">
              <span className="flex items-center justify-between gap-3 text-xl font-semibold">
                {d.label}
                <span className="arrow-chip">→</span>
              </span>
              <span className="text-sm text-muted">{d.note}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
