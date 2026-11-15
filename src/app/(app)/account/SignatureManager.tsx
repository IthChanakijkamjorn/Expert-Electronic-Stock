"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { uploadToStorage } from "@/components/upload";
import { addSignature, deleteSignature, setDefaultSignature } from "./signature-actions";

export type SignatureItem = { id: string; name: string; url?: string; isDefault: boolean };

export function SignatureManager({
  items,
  labels,
}: {
  items: SignatureItem[];
  labels: {
    name: string; upload: string; makeDefault: string; isDefault: string; remove: string;
    confirm: string; failed: string; empty: string;
  };
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setFailed(false);
    try {
      const path = await uploadToStorage("images/signature", file);
      await addSignature(name || file.name.replace(/\.[^.]+$/, ""), path);
      setName("");
      router.refresh();
    } catch {
      setFailed(true);
    }
    setBusy(false);
  }

  const run = (fn: () => Promise<void>) => start(async () => { await fn(); router.refresh(); });

  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 && <p className="text-muted">{labels.empty}</p>}
      <ul className="flex flex-col gap-2">
        {items.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 rounded border border-[#cfc9dc] bg-white p-2">
            {s.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.url} alt="" className="h-14 w-28 object-contain" />
            )}
            <span className="font-medium">{s.name}</span>
            {s.isDefault ? (
              <span className="pill bg-navy text-white">{labels.isDefault}</span>
            ) : (
              <button disabled={pending} onClick={() => run(() => setDefaultSignature(s.id))} className="text-sm underline">
                {labels.makeDefault}
              </button>
            )}
            <button
              disabled={pending}
              onClick={() => confirm(labels.confirm) && run(() => deleteSignature(s.id))}
              className="ml-auto text-sm text-red-600 underline"
            >
              {labels.remove}
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} className="input max-w-xs" placeholder={labels.name} maxLength={80} />
        <label className="inline-flex w-fit cursor-pointer rounded-full border border-[#cfc9dc] bg-white px-3 py-1 text-xs font-semibold text-navy transition hover:bg-navy hover:text-white">
          {busy ? "…" : labels.upload}
          <input
            type="file"
            accept="image/png,image/jpeg"
            disabled={busy}
            onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }}
            className="sr-only"
          />
        </label>
        {failed && <span className="text-xs text-red-600">{labels.failed}</span>}
      </div>
    </div>
  );
}
