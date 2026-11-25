"use client";

import { useActionState } from "react";
import { createProduct } from "./actions";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function ProductForm({ t }: { t: Dictionary }) {
  const [state, action, pending] = useActionState(createProduct, null);
  const field = "input mt-1";
  return (
    <form action={action} className="card flex max-w-md flex-col gap-3">
      <label>{t.brand} *<input name="brand" required className={field} /></label>
      <label>{t.modelLabel} *<input name="model" required className={field} /></label>
      <label>{t.name}<input name="name" className={field} /></label>
      <p className="-mt-2 text-xs text-muted">{t.nameHint}</p>
      <label>{t.category}<input name="category" className={field} /></label>
      <label>{t.descriptionLabel}<textarea name="description" rows={4} className={field} /></label>
      <label>{t.shortDescriptionLabel}<textarea name="short_description" rows={2} placeholder={t.shortDescriptionHint} className={field} /></label>
      <label>{t.unit}<input name="unit" defaultValue="ชิ้น" className={field} /></label>
      <label>{t.supplier}<input name="supplier" className={field} /></label>
      {state?.error && <p className="text-red-600">{t.saveFailed}</p>}
      <button disabled={pending} className="btn">
        {t.save}
      </button>
    </form>
  );
}
