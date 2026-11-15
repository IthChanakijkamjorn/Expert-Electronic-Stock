import { getDictionary } from "@/lib/i18n";
import { verifiedTotpFactor } from "@/lib/mfa";
import { TwoFactor } from "./TwoFactor";

export default async function AccountPage() {
  const { t } = await getDictionary();
  const factor = await verifiedTotpFactor();
  return (
    <section className="flex max-w-xl flex-col gap-4">
      <h1 className="text-3xl font-semibold">{t.account}</h1>
      <div className="card flex flex-col gap-3 p-6">
        <h2 className="text-xl font-semibold text-navy">{t.twoFactor}</h2>
        <p className="text-muted">{t.twoFactorHelp}</p>
        <TwoFactor
          factorId={factor?.id ?? null}
          labels={{
            on: t.twoFactorOn, off: t.twoFactorOff, enable: t.enable2fa, disable: t.disable2fa,
            scan: t.scanQr, manual: t.manualKey, code: t.sixDigitCode, verify: t.verify, invalid: t.invalidCode,
          }}
        />
      </div>
    </section>
  );
}
