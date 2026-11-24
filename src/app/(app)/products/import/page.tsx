import Link from "next/link";
import { redirect } from "next/navigation";
import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";
import { ImportRunner } from "./ImportRunner";

export const maxDuration = 60;

export default async function ImportPage() {
  const { t } = await getDictionary();
  const role = await getRole();
  if (role !== "admin" && role !== "manager") redirect("/products");
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Link href="/products" className="text-sm text-muted hover:underline">{t.back}</Link>
      <h1 className="page-title">{t.importProducts}</h1>
      <p className="text-muted">{t.importHelp}</p>
      <ImportRunner labels={{ start: t.importStart, upload: t.importUpload, uploadHelp: t.importUploadHelp, removeMissing: t.importRemoveMissing, removeConfirm: t.importRemoveConfirm, removeBlocked: t.importRemoveBlocked, removed: t.importRemoved, running: t.importRunning, done: t.importDone, failed: t.importFailed, website: t.website }} isAdmin={role === "admin"} />
    </div>
  );
}
