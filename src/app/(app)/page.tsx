import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { verifiedTotpFactor } from "@/lib/mfa";
import { DASH_COOKIE, DashboardGroups, type DashGroup } from "@/components/DashboardGroups";

export default async function Dashboard() {
  const { lang, t } = await getDictionary();
  const d = t.dash;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: profile }, { data: stock }, jar] = await Promise.all([
    supabase.from("profiles").select("full_name, role").eq("id", user!.id).single(),
    supabase.from("product_stock").select("stock").eq("active", true).limit(5000),
    cookies(),
  ]);
  const negCount = (stock ?? []).filter((p) => p.stock < 0).length;
  const lowCount = (stock ?? []).filter((p) => p.stock < 5).length;

  const needs2fa = profile?.role === "admin" && !(await verifiedTotpFactor());
  const manager = profile?.role === "admin" || profile?.role === "manager";

  const groups: DashGroup[] = [
    {
      id: "inventory",
      icon: "📦",
      title: d.inventory,
      desc: d.inventoryDesc,
      accent: "linear-gradient(135deg, #0ea5e9, #2563eb)",
      badge: lowCount > 0 ? `⚠ ${lowCount}` : undefined,
      items: [
        { href: "/products", label: t.products, desc: d.productsDesc, icon: "🏷️" },
        { href: "/movements", label: t.movements, desc: d.movementsDesc, icon: "🔄" },
        { href: "/stock-list", label: t.stockList, desc: d.stockListDesc, icon: "📋" },
        ...(manager ? [{ href: "/goods-receipts", label: t.goodsReceived, desc: d.goodsReceivedDesc, icon: "🚚" }] : []),
      ],
    },
    {
      id: "sales",
      icon: "🧾",
      title: d.sales,
      desc: d.salesDesc,
      accent: "linear-gradient(135deg, #8b5cf6, #4f46e5)",
      items: [
        ...(manager ? [{ href: "/quotations", label: t.quotation, desc: d.quotationDesc, icon: "💼" }] : []),
        { href: "/invoices", label: t.taxInvoices, desc: t.docStockLinked, icon: "🧮" },
        ...(manager
          ? [
              { href: "/receipts", label: t.receipt, desc: d.receiptDesc, icon: "💵" },
              { href: "/quotations/compare", label: d.compare, desc: d.compareDesc, icon: "⚖️" },
            ]
          : []),
        { href: "/documents", label: d.allDocs, desc: d.allDocsDesc, icon: "🗂️" },
      ],
    },
    {
      id: "projects",
      icon: "🏗️",
      title: d.projects,
      desc: d.projectsDesc,
      accent: "linear-gradient(135deg, #f59e0b, #ea580c)",
      items: [
        { href: "/projects", label: t.projects, desc: d.projectsItemDesc, icon: "🏢" },
        { href: "/floorplans", label: t.floorPlans, desc: d.floorPlansDesc, icon: "📐" },
        { href: "/cad", label: d.cad, desc: d.cadDesc, icon: "✏️" },
      ],
    },
  ];
  const saved = jar.get(DASH_COOKIE)?.value;
  const initialOpen = saved === undefined ? ["inventory"] : saved.split(",").filter((id) => groups.some((g) => g.id === id));

  const now = new Date();
  const hour = Number(now.toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Bangkok" }));
  const greeting = hour < 12 ? d.morning : hour < 17 ? d.afternoon : d.evening;
  const today = now.toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" });

  return (
    <section className="flex flex-col gap-6">
      <div className="dash-hero">
        <span className="dash-orb -right-10 -top-12 h-48 w-48" />
        <span className="dash-orb -bottom-16 right-32 h-32 w-32 [animation-delay:-3s]" />
        <span className="dash-orb right-1/3 top-6 h-10 w-10 [animation-delay:-6s]" />
        <p className="relative text-sm font-medium text-white/70">{today}</p>
        <h1 className="relative mt-2 text-3xl font-bold sm:text-4xl">
          {greeting}, {profile?.full_name || user!.email}
        </h1>
        {profile && (
          <p className="relative mt-1 text-white/75">
            {t.role}: {t.roles[profile.role as keyof typeof t.roles]}
          </p>
        )}
        <div className="relative mt-5 flex flex-wrap gap-2">
          {negCount > 0 && (
            <Link href="/stock-list?low=1" className="dash-stat dash-stat-alert !bg-red-500/90">
              🔴 {t.negativeStockTitle}: {negCount}
            </Link>
          )}
          {lowCount > 0 ? (
            <Link href="/stock-list?low=1" className="dash-stat">
              ⚠ {t.lowStockTitle}: {lowCount}
            </Link>
          ) : (
            <span className="dash-stat">✅ {d.stockOk}</span>
          )}
        </div>
      </div>

      {needs2fa && (
        <Link href="/account" className="card card-link dash-in !border-amber-300 !bg-amber-50 font-semibold text-amber-800">
          🔐 {t.admin2faReminder}
        </Link>
      )}

      <DashboardGroups groups={groups} initialOpen={initialOpen} menusLabel={d.menus} />

      <div className="dash-in flex flex-wrap items-center gap-2" style={{ "--i": 5 } as React.CSSProperties}>
        <span className="mr-1 text-sm font-semibold text-muted">{d.quick}</span>
        <Link href="/account" className="dash-quick">👤 {t.account}</Link>
        {profile?.role === "admin" && (
          <>
            <Link href="/users" className="dash-quick">👥 {t.users}</Link>
            <Link href="/audit" className="dash-quick">📜 {t.auditLog}</Link>
          </>
        )}
      </div>
    </section>
  );
}
