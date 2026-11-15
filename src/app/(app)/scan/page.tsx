import { getDictionary } from "@/lib/i18n";
import { Scanner } from "./Scanner";

export default async function ScanPage() {
  const { t } = await getDictionary();
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold">{t.scan}</h1>
        <p className="mt-1 text-muted">{t.scanHelp}</p>
      </div>
      <Scanner
        labels={{ start: t.startCamera, stop: t.stopCamera, manual: t.scanManual, go: t.open, notFound: t.scanNotFound, cameraError: t.cameraError }}
      />
    </section>
  );
}
