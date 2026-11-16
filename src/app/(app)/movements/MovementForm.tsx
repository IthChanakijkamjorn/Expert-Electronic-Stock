"use client";

import { useActionState } from "react";
import { recordMovement } from "./actions";
import { ProductPicker } from "./ProductPicker";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function MovementForm({
  t,
  products,
  projects = [],
  fixedProjectId,
  defaultDirection = "in",
  defaultType = "purchase",
}: {
  fixedProjectId?: string;
  defaultDirection?: "in" | "out";
  defaultType?: string;
  t: Dictionary;
  projects?: { id: string; label: string }[];
  locations?: { id: string; name: string; is_default: boolean }[];
  products: { id: string; name: string; sku: string | null; brand?: string | null; stock: number; unit: string }[];
}) {
  const [state, action, pending] = useActionState(recordMovement, null);
  const field = "input mt-1";
  return (
    <form action={action} className="card flex flex-col gap-3">
      <div>
        <span>{t.product}</span>
        <ProductPicker products={products} placeholder={t.searchProducts} emptyText={t.noMatches} newText={t.addNewProduct} />
      </div>
      <label>
        {t.direction}
        <select name="direction" className={field} defaultValue={defaultDirection}>
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
        <select name="type" className={field} defaultValue={defaultType}>
          {Object.entries(t.movementTypes).filter(([k]) => k !== "transfer" && k !== "sale").map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </label>
      {fixedProjectId && <input type="hidden" name="project_id" value={fixedProjectId} />}
      {!fixedProjectId && projects.length > 0 && (
        <label>
          {t.projects}
          <select name="project_id" className={field} defaultValue="">
            <option value="">{t.noProject}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </label>
      )}
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
