"use client";

import { SalesPicker } from "@/components/SalesPicker";
import { addRequester, deleteRequester, renameRequester, type Salesperson } from "@/app/(app)/documents/actions";
import type { Dictionary } from "@/lib/i18n/dictionaries";

// Internal tag (who asked for this document). Saved with the form but never printed.
export function RequesterField({ t, list, value, onChange }: { t: Dictionary; list: Salesperson[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="min-w-48 text-sm">
      {t.requester}
      <div className="mt-1 rounded-lg border border-zinc-300 bg-white px-1">
        <SalesPicker
          api={{ add: addRequester, rename: renameRequester, remove: deleteRequester }}
          initial={list}
          value={value}
          onChange={onChange}
          labels={{ add: t.salesAdd, remove: t.remove, save: t.save, confirm: t.salesRemoveConfirm }}
        />
      </div>
    </div>
  );
}
