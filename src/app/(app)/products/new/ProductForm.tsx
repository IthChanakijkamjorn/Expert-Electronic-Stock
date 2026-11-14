"use client";

import { useActionState } from "react";
import { createProduct } from "./actions";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function ProductForm({ t }: { t: Dictionary }) {
  const [state, action, pending] = useActionState(createProduct, null);
  const field = "w-full rounded border border-zinc-300 px-3 py-1.5";
  return (
    <form action={action} className="flex max-w-md flex-col gap-3">
      <label>{t.name}<input name="name" required className={field} /></label>
      <label>{t.sku}<input name="sku" className={field} /></label>
      <label>{t.brand}<input name="brand" className={field} /></label>
      <label>{t.category}<input name="category" className={field} /></label>
      <label>{t.unit}<input name="unit" defaultValue="pcs" className={field} /></label>
      <label>{t.supplier}<input name="supplier" className={field} /></label>
      <label>{t.location}<input name="location" className={field} /></label>
      <label>{t.minStock}<input name="min_stock" type="number" min={0} defaultValue={0} className={field} /></label>
      {state?.error && <p className="text-red-600">{t.saveFailed}</p>}
      <button disabled={pending} className="rounded bg-black px-3 py-2 text-white disabled:opacity-50">
        {t.save}
      </button>
    </form>
  );
}
