"use client";

import { useState, useTransition } from "react";
import { createShare } from "@/app/(app)/products/file-actions";

export function ShareButton({
  path,
  fileName,
  labels,
}: {
  path: string;
  fileName: string;
  labels: { share: string; days: string; create: string; copy: string; copied: string; failed: string };
}) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(7);
  const [url, setUrl] = useState("");
  const [state, setState] = useState<"" | "copied" | "failed">("");
  const [pending, start] = useTransition();

  function create() {
    setState("");
    start(async () => {
      try {
        const token = await createShare(path, fileName, days);
        setUrl(`${window.location.origin}/s/${token}`);
      } catch {
        setState("failed");
      }
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="font-semibold text-navy underline">
        {labels.share}
      </button>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2">
      <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="input w-auto py-1">
        {[1, 7, 30, 90].map((d) => (
          <option key={d} value={d}>{d} {labels.days}</option>
        ))}
      </select>
      <button type="button" onClick={create} disabled={pending} className="btn-ghost py-1">
        {labels.create}
      </button>
      {url && (
        <>
          <input readOnly value={url} onFocus={(e) => e.target.select()} className="input w-56 py-1" />
          <button
            type="button"
            className="font-semibold text-navy underline"
            onClick={() => navigator.clipboard.writeText(url).then(() => setState("copied"))}
          >
            {state === "copied" ? labels.copied : labels.copy}
          </button>
        </>
      )}
      {state === "failed" && <span className="text-red-600">{labels.failed}</span>}
    </span>
  );
}
