import { getDictionary } from "@/lib/i18n";
import { LangSwitch } from "@/lib/i18n/LangSwitch";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const { lang, t } = await getDictionary();
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t.appName}</h1>
        <LangSwitch current={lang} />
      </div>
      <LoginForm
        labels={{
          email: t.email,
          password: t.password,
          login: t.login,
          invalidCredentials: t.invalidCredentials,
        }}
      />
    </main>
  );
}
