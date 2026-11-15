import { getDictionary } from "@/lib/i18n";
import { verifiedTotpFactor } from "@/lib/mfa";
import { getRole } from "@/lib/role";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/storage";
import { ImageUploader } from "@/components/ImageUploader";
import { TwoFactor } from "./TwoFactor";
import { removeSignature, setSignature } from "./signature-actions";

export default async function AccountPage() {
  const { t } = await getDictionary();
  const factor = await verifiedTotpFactor();
  const isAdmin = (await getRole()) === "admin";
  let sigUrl: string | undefined;
  if (isAdmin) {
    const { data } = await (await createClient()).from("company_settings").select("value").eq("key", "signature").maybeSingle();
    if (data?.value) sigUrl = (await signedUrls([data.value])).get(data.value);
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
          {sigUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sigUrl} alt="" className="h-20 w-fit rounded border border-[#cfc9dc] bg-white object-contain p-1" />
          )}
          <div className="flex flex-wrap items-center gap-3">
            <ImageUploader
              prefix="images/signature"
              record={setSignature}
              label={`🖼 ${t.signature}`}
              failedText={t.uploadFailed}
              accept="image/png,image/jpeg"
            />
            {sigUrl && (
              <form action={removeSignature}>
                <button className="text-sm text-red-600 underline">{t.removeSignature}</button>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
