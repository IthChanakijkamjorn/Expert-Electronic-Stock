"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function RenameForm({
  initial,
  action,
  labels,
}: {
  initial: string;
  action: (name: string) => Promise<void>;
  labels: { rename: string; save: string; cancel: string; failed: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setName(initial);
          setFailed(false);
          setOpen(true);
        }}
        className="rounded-full border border-[#cfc9dc] px-3 py-1 text-xs font-semibold text-navy transition hover:bg-navy hover:text-white"
      >
        ✎ {labels.rename}
      </button>
    );
  }
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setFailed(false);
        start(async () => {
          try {
            await action(name);
            setOpen(false);
            router.refresh();
          } catch {
            setFailed(true);
          }
        });
      }}
    >
      <input
        autoFocus
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="input w-64 py-1.5"
      />
      <button disabled={pending} className="btn py-1.5">{labels.save}</button>
      <button type="button" onClick={() => setOpen(false)} className="btn-ghost py-1.5">
        {labels.cancel}
      </button>
      {failed && <span className="text-sm text-red-600">{labels.failed}</span>}
    </form>
  );
}
