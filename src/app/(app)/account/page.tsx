import { getDictionary } from "@/lib/i18n";
import { verifiedTotpFactor } from "@/lib/mfa";
import { getRole } from "@/lib/role";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/storage";
import { TwoFactor } from "./TwoFactor";
import { SignatureManager, type SignatureItem } from "./SignatureManager";

export default async function AccountPage() {
  const { t } = await getDictionary();
  const factor = await verifiedTotpFactor();
  const isAdmin = (await getRole()) === "admin";
  let sigItems: SignatureItem[] = [];
  if (isAdmin) {
    const { data } = await (await createClient()).from("signatures").select("id, name, path, is_default").order("created_at");
    const urls = await signedUrls((data ?? []).map((r) => r.path));
    sigItems = (data ?? []).map((r) => ({ id: r.id, name: r.name, url: urls.get(r.path), isDefault: r.is_default }));
  }
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
      {isAdmin && (
        <div className="card flex flex-col gap-3 p-6">
          <h2 className="text-xl font-semibold text-navy">{t.signature}</h2>
          <p className="text-muted">{t.signatureHelp}</p>
          <SignatureManager
            items={sigItems}
            labels={{
              name: t.signatureName, upload: `🖼 ${t.addSignature}`, makeDefault: t.makeDefault, isDefault: t.defaultLabel,
              remove: t.removeSignature, confirm: t.confirmRemoveSignature, failed: t.uploadFailed, empty: t.noSignatures,
            }}
          />
        </div>
      )}
    </section>
  );
}
