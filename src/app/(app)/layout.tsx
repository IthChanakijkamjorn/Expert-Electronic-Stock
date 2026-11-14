import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { LangSwitch } from "@/lib/i18n/LangSwitch";
import { signOut } from "../login/actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { lang, t } = await getDictionary();
  const nav = [t.dashboard, t.products, t.movements, t.projects];

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
        <div className="flex items-center gap-6">
          <strong>{t.appName}</strong>
          <nav className="flex gap-4 text-sm text-zinc-700">
            {nav.map((n) => (
              <span key={n}>{n}</span>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <LangSwitch current={lang} />
          <form action={signOut}>
            <button className="text-sm underline">{t.logout}</button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
