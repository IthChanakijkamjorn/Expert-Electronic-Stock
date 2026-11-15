import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { LangSwitch } from "@/lib/i18n/LangSwitch";
import { getRole } from "@/lib/role";
import { signOut } from "../login/actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/login");

  const { lang, t } = await getDictionary();
  const [role, { data: aalOk }] = await Promise.all([getRole(), supabase.rpc("aal_ok")]);
  if (aalOk === false) redirect("/login/mfa");
  const manager = role === "admin" || role === "manager";
  type NavItem = { href: string; label: string; children?: { href: string; label: string }[] };
  const nav: NavItem[] = [
    { href: "/", label: t.dashboard },
    {
      href: "/products",
      label: t.navStock,
      children: [
        { href: "/products", label: t.products },
        { href: "/movements", label: t.movements },
        { href: "/low-stock", label: t.lowStock },
        { href: "/scan", label: t.scan },
        ...(manager ? [{ href: "/stocktake", label: t.stocktake }, { href: "/locations", label: t.locations }] : []),
      ],
    },
    {
      href: "/documents",
      label: t.documents,
      children: [
        { href: "/invoices", label: t.taxInvoices },
        { href: "/quotations", label: t.quotation },
        { href: "/receipts", label: t.receipt },
      ],
    },
    {
      href: "/projects",
      label: t.projects,
      children: [
        { href: "/projects", label: t.projects },
        { href: "/floorplans", label: t.floorPlans },
      ],
    },
    ...(manager
      ? [{ href: "/purchasing", label: t.purchasing, children: [{ href: "/purchasing", label: t.purchasing }, { href: "/suppliers", label: t.suppliers }] }]
      : []),
    ...(role === "admin"
      ? [{ href: "/users", label: t.navAdmin, children: [{ href: "/users", label: t.users }, { href: "/audit", label: t.auditLog }] }]
      : []),
  ];

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-40 print:hidden bg-navy text-white shadow-[0_12px_30px_rgba(0,0,0,0.28)]">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo.png" alt="" width={36} height={36} priority />
            <span className="font-serif text-base font-semibold sm:text-lg">
              Expert Electronic &amp; Communication
            </span>
          </Link>
          <nav className="order-last flex w-full flex-wrap gap-x-6 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.2em] md:order-none md:w-auto">
            {nav.map((n) => (
              <div key={n.label} className="group relative">
                <Link href={n.href} className="block py-1 text-white/80 hover:text-white">
                  {n.label}
                  {n.children && " ▾"}
                </Link>
                {n.children && (
                  <div className="absolute left-0 top-full z-50 hidden min-w-44 pt-1 group-hover:block">
                    <div className="flex flex-col rounded-lg bg-navy py-1 shadow-xl ring-1 ring-white/15">
                      {n.children.map((c) => (
                        <Link key={c.href} href={c.href} className="whitespace-nowrap px-4 py-2 text-white/80 hover:bg-white/10 hover:text-white">
                          {c.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/account" className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80 hover:text-white">{t.account}</Link>
            <LangSwitch current={lang} />
            <form action={signOut}>
              <button className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80 hover:text-white">
                {t.logout}
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 py-8">{children}</main>
    </div>
  );
}
