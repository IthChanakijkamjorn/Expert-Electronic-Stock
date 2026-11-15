"use client";

import { useActionState } from "react";
import { transferStock } from "@/app/(app)/movements/actions";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function TransferForm({
  productId,
  locations,
  t,
}: {
  productId: string;
  locations: { id: string; name: string }[];
  t: Dictionary;
}) {
  const [state, action, pending] = useActionState(transferStock.bind(null, productId), null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="text-sm">
        {t.fromLocation}
        <select name="from" className="input mt-1" defaultValue={locations[0]?.id}>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </label>
      <label className="text-sm">
        {t.toLocation}
        <select name="to" className="input mt-1" defaultValue={locations[1]?.id}>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </label>
      <label className="text-sm">
        {t.quantity}
        <input name="quantity" type="number" min={1} required className="input mt-1 w-28" />
      </label>
      <label className="text-sm">
        {t.comment}
        <input name="comment" className="input mt-1" />
      </label>
      <button disabled={pending} className="btn">{t.transferStock}</button>
      {state?.error && (
        <p className="w-full text-red-600">{state.error === "insufficient" ? t.insufficientStock : t.saveFailed}</p>
      )}
      {state?.ok && <p className="text-green-700">✓</p>}
    </form>
  );
}
