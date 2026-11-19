import Link from "next/link";
import { deleteDraft } from "@/app/(app)/documents/actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export type DraftRow = { id: string; customer: string; project?: string; updated_at: string };

export function DraftList({ rows, base, kind, t, lang }: { rows: DraftRow[]; base: string; kind: "invoices" | "quotations" | "receipts"; t: Dictionary; lang: string }) {
  if (!rows.length) return null;
  const stamp = (d: string) =>
    new Date(d).toLocaleString(lang === "th" ? "th-TH" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });
  return (
    <div className="card p-4">
      <h2 className="mb-2 text-lg font-semibold">{t.drafts} ({rows.length})</h2>
      <ul className="flex flex-col gap-1 text-sm">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2">
            <span className="pill">{t.draftLabel}</span>
            <Link href={`${base}/${r.id}/edit`} className="flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-lg px-2 py-2 hover:bg-zinc-100">
              <span className="font-semibold text-navy underline">{r.project || (r.customer === "-" ? "—" : r.customer)}</span>
              {r.project && r.customer !== "-" && <span className="text-muted">· {r.customer}</span>}
              <span className="text-muted">{t.lastUpdated}: {stamp(r.updated_at)}</span>
            </Link>
            <form action={deleteDraft.bind(null, kind, r.id)} className="ml-auto">
              <ConfirmButton message={t.deleteDraftConfirm} className="text-red-700 underline">{t.deleteDraft}</ConfirmButton>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
