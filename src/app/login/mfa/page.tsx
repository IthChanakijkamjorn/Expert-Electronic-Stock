import Image from "next/image";
import { getDictionary } from "@/lib/i18n";
import { MfaForm } from "./MfaForm";

export default async function MfaPage() {
  const { t } = await getDictionary();
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-6">
      <div className="card flex flex-col gap-6 p-8">
        <Image src="/logo.png" alt="Expert Electronic" width={48} height={48} priority />
        <h1 className="text-2xl font-semibold">{t.enter2faCode}</h1>
        <MfaForm labels={{ code: t.sixDigitCode, verify: t.verify, invalid: t.invalidCode }} />
      </div>
    </main>
  );
}
