"use client";

import { useActionState } from "react";
import { createProduct } from "./actions";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function ProductForm({ t }: { t: Dictionary }) {
  const [state, action, pending] = useActionState(createProduct, null);
  const field = "input mt-1";
  return (
    <form action={action} className="card flex max-w-md flex-col gap-3">
      <label>{t.name}<input name="name" required className={field} /></label>
      <label>{t.modelLabel}<input name="model" className={field} /></label>
      <label>{t.brand}<input name="brand" className={field} /></label>
      <label>{t.category}<input name="category" className={field} /></label>
      <label>{t.unit}<input name="unit" defaultValue="ชิ้น" className={field} /></label>
      <label>{t.supplier}<input name="supplier" className={field} /></label>
      {state?.error && <p className="text-red-600">{t.saveFailed}</p>}
      <button disabled={pending} className="btn">
        {t.save}
      </button>
    </form>
  );
}
