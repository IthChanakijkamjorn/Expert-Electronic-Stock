"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";

export type DeleteLabels = {
  delete: string;
  warning: string;
  message: string;
  ok: string;
  cancel: string;
};

export function DeleteButton({
  action,
  name,
  labels,
}: {
  action: () => Promise<void>;
  name: string;
  labels: DeleteLabels;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-red-700"
      >
        🗑 {labels.delete}
      </button>
      {open && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="alertdialog"
          aria-modal="true"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl">⚠️</div>
            <h2 className="text-xl font-semibold text-red-700">
              {labels.warning} “{name}”
            </h2>
            <p className="mt-2 text-sm text-muted">{labels.message}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" disabled={pending} onClick={() => setOpen(false)} className="btn-ghost">
                {labels.cancel}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => start(async () => {
                  await action();
                  setOpen(false);
                })}
                className="inline-flex items-center justify-center rounded-full bg-red-600 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? "…" : labels.ok}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
