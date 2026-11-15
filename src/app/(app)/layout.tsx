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
  const role = await getRole();
  const nav = [
    { href: "/", label: t.dashboard },
    { href: "/products", label: t.products },
    { href: "/movements", label: t.movements },
    { href: "/projects", label: t.projects },
    ...(role === "admin"
      ? [{ href: "/users", label: t.users }, { href: "/audit", label: t.auditLog }]
      : []),
  ];

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-40 bg-navy text-white shadow-[0_12px_30px_rgba(0,0,0,0.28)]">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo.png" alt="" width={36} height={36} priority />
            <span className="font-serif text-base font-semibold sm:text-lg">
              Expert Electronic &amp; Communication
            </span>
          </Link>
          <nav className="flex gap-5 text-[11px] font-semibold uppercase tracking-[0.2em]">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="text-white/80 hover:text-white">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
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
