"use client";

import { useActionState } from "react";
import { recordMovement } from "./actions";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function MovementForm({
  t,
  products,
}: {
  t: Dictionary;
  products: { id: string; name: string; sku: string | null; stock: number; unit: string }[];
}) {
  const [state, action, pending] = useActionState(recordMovement, null);
  const field = "input mt-1";
  return (
    <form action={action} className="card flex max-w-md flex-col gap-3">
      <label>
        {t.product}
        <select name="product_id" required className={field} defaultValue="">
          <option value="" disabled>{t.selectProduct}</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.sku ? `${p.sku} · ` : ""}{p.name} ({p.stock} {p.unit})
            </option>
          ))}
        </select>
      </label>
      <label>
        {t.direction}
        <select name="direction" className={field}>
          <option value="in">{t.stockIn}</option>
          <option value="out">{t.stockOut}</option>
        </select>
      </label>
      <label>
        {t.quantity}
        <input name="quantity" type="number" min={1} step={1} required className={field} />
      </label>
      <label>
        {t.reason}
        <select name="type" className={field}>
          {Object.entries(t.movementTypes).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </label>
      <label>
        {t.comment}
        <textarea name="comment" required rows={3} placeholder={t.commentHint} className={field} />
      </label>
      {state?.error && (
        <p className="text-red-600">
          {state.error === "insufficient" ? t.insufficientStock : t.saveFailed}
        </p>
      )}
      {state?.ok && <p className="text-green-700">✓</p>}
      <button disabled={pending} className="btn">
        {t.save}
      </button>
    </form>
  );
}
