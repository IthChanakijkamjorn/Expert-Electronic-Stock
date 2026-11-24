"use client";

import { useActionState, useState } from "react";
import { recordMovement } from "./actions";
import { ProductPicker } from "./ProductPicker";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type Product = { id: string; name: string; model: string | null; brand?: string | null; stock: number; unit: string };
type Direction = "in" | "out";

const REASONS: Record<Direction, string[]> = {
  in: ["purchase", "return_from_site", "count_correction", "other"],
  out: ["sale", "project_use", "count_correction", "other"],
};
const PROJECT_REASON: Record<Direction, string> = { in: "return_from_site", out: "project_use" };

export function MovementForm({
  t,
  products,
  projects = [],
  suppliers = [],
  defaultDirection = "in",
}: {
  t: Dictionary;
  products: Product[];
  projects?: { id: string; label: string }[];
  suppliers?: string[];
  defaultDirection?: Direction;
}) {
  const [state, action, pending] = useActionState(recordMovement, null);
  const [dir, setDir] = useState<Direction>(defaultDirection);
  const [reason, setReason] = useState<Record<Direction, string>>({ in: "purchase", out: "sale" });
  const isIn = dir === "in";

  return (
    <div className={`mv-card ${isIn ? "mv-in" : "mv-out"}`}>
      <div className="mv-tabs" role="tablist">
        <span className="mv-tab-indicator" style={{ transform: isIn ? "translateX(0)" : "translateX(100%)" }} />
        {(["in", "out"] as const).map((d) => (
          <button key={d} type="button" role="tab" aria-selected={dir === d} className="mv-tab" onClick={() => setDir(d)}>
            <span className="text-lg">{d === "in" ? "⬇" : "⬆"}</span> {d === "in" ? t.mv.inTab : t.mv.outTab}
          </button>
        ))}
      </div>

      {/* Keyed by direction so each tab starts clean and animates in; also reset after a successful save. */}
      <Body
        key={`${dir}-${state?.at ?? 0}`}
        {...{ t, products, projects, suppliers, dir, state, pending, action }}
        reason={reason[dir]}
        setReason={(v) => setReason((r) => ({ ...r, [dir]: v }))}
      />
    </div>
  );
}

function Body({
  t,
  products,
  projects,
  suppliers,
  dir,
  state,
  pending,
  action,
  reason,
  setReason,
}: {
  t: Dictionary;
  products: Product[];
  projects: { id: string; label: string }[];
  suppliers: string[];
  dir: Direction;
  state: Awaited<ReturnType<typeof recordMovement>>;
  pending: boolean;
  action: (fd: FormData) => void;
  reason: string;
  setReason: (v: string) => void;
}) {
  const [product, setProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState("");
  const m = t.mv;
  const isIn = dir === "in";
  const showProject = reason === PROJECT_REASON[dir];
  const reasonLabel = (k: string) => (k === "sale" ? m.sale : k === "project_use" ? m.projectUse : t.movementTypes[k as keyof typeof t.movementTypes]);
  const over = !isIn && product && Number(qty) > product.stock;
  const field = "input mt-1";
  return (
    <form action={action} className="fade-up flex flex-col gap-4 p-5">
      <p className="text-sm text-muted">{isIn ? m.inHint : m.outHint}</p>
      <input type="hidden" name="direction" value={dir} />

      {isIn && (
        <label>
          {m.supplier} <span className="text-xs text-muted">({m.optional})</span>
          <input name="supplier" list="mv-suppliers" className={field} placeholder={m.supplierHint} autoComplete="off" />
          <datalist id="mv-suppliers">
            {suppliers.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
      )}

      <div>
        <span>{t.product}</span>
        <ProductPicker
          products={products}
          placeholder={t.searchProducts}
          emptyText={t.noMatches}
          newText={isIn ? t.addNewProduct : undefined}
          onSelect={setProduct}
        />
        {product && (
          <p className="fade-up mt-1 text-xs text-muted">
            {m.inStock}:{" "}
            <b className={product.stock <= 0 ? "text-red-600" : "text-navy"}>
              {product.stock} {product.unit}
            </b>
          </p>
        )}
      </div>

      <label>
        {t.quantity}
        <input name="quantity" type="number" min={1} step={1} required className={field} value={qty} onChange={(e) => setQty(e.target.value)} />
        {over && <span className="fade-up mt-1 block text-xs font-semibold text-red-600">⚠ {t.insufficientStock}</span>}
      </label>

      <label>
        {t.reason}
        <select name="type" className={field} value={reason} onChange={(e) => setReason(e.target.value)}>
          {REASONS[dir].map((k) => (
            <option key={k} value={k}>
              {reasonLabel(k)}
            </option>
          ))}
        </select>
      </label>

      <div className="reveal" data-open={showProject}>
        <div className="min-h-0">
          <label className="block pb-1">
            {t.projects}
            <select name="project_id" className={field} defaultValue="" required={showProject && !isIn} disabled={!showProject}>
              <option value="">{isIn ? t.noProject : m.selectProject}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <label>
        {m.note} <span className="text-xs text-muted">({m.optional})</span>
        <textarea name="comment" rows={2} placeholder={m.noteHint} className={field} />
      </label>

      {state?.error && (
        <p className="fade-up rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error === "insufficient"
            ? t.insufficientStock
            : state.error === "project"
              ? m.needProject
              : state.error === "invalid"
                ? m.needProduct
                : t.saveFailed}
        </p>
      )}
      {state?.ok && <p className="fade-up rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">✓ {m.saved}</p>}
      <button disabled={pending} className={`btn mv-submit ${pending ? "opacity-60" : ""}`}>
        {pending ? "…" : isIn ? m.saveIn : m.saveOut}
      </button>
    </form>
  );
}
