"use client";

import { useState } from "react";
import { revokeShare } from "@/app/(app)/products/file-actions";

export type ShareRow = { id: string; token: string; file_name: string; expires_at: string };

export function ActiveShares({
  shares,
  locale,
  showFileName = true,
  labels,
}: {
  shares: ShareRow[];
  locale: string;
  showFileName?: boolean;
  labels: { copy: string; copied: string; revoke: string; expires: string };
}) {
  const [copied, setCopied] = useState("");
  const fmt = (d: string) => new Date(d).toLocaleString(locale, { timeZone: "Asia/Bangkok" });
  return (
    <ul className="divide-y divide-[#ece8f2] text-sm">
      {shares.map((s) => {
        const url = `${window.location.origin}/s/${s.token}`;
        return (
          <li key={s.id} className="flex flex-wrap items-center gap-2 py-2">
            {showFileName && <span className="min-w-40 font-medium">{s.file_name}</span>}
            <input readOnly value={url} onFocus={(e) => e.target.select()} className="input min-w-0 flex-1 py-1" />
            <button
              type="button"
              className="font-semibold text-navy underline"
              onClick={() => navigator.clipboard.writeText(url).then(() => setCopied(s.id))}
            >
              {copied === s.id ? labels.copied : labels.copy}
            </button>
            <span className="text-muted">{labels.expires} {fmt(s.expires_at)}</span>
            <form action={revokeShare.bind(null, s.id)}>
              <button className="text-red-600 underline">{labels.revoke}</button>
            </form>
          </li>
        );
      })}
    </ul>
  );
}
