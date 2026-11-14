import Image from "next/image";
import { getDictionary } from "@/lib/i18n";
import { LangSwitch } from "@/lib/i18n/LangSwitch";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const { lang, t } = await getDictionary();
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-6">
      <div className="card flex flex-col gap-6 p-8">
        <div className="flex items-center justify-between">
          <Image src="/logo.png" alt="Expert Electronic" width={48} height={48} priority />
          <LangSwitch current={lang} dark={false} />
        </div>
        <div>
          <p className="eyebrow">Expert Electronic &amp; Communication</p>
          <h1 className="mt-2 text-2xl font-semibold">{t.appName}</h1>
        </div>
        <LoginForm
          labels={{
            email: t.email,
            password: t.password,
            login: t.login,
            invalidCredentials: t.invalidCredentials,
          }}
        />
      </div>
    </main>
  );
}
