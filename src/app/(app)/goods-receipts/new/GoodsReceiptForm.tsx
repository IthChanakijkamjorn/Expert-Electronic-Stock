"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { uploadToStorage } from "@/components/upload";
import { ProductPicker } from "../../movements/ProductPicker";
import { createGoodsReceipt } from "../actions";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type Product = { id: string; name: string; sku: string | null; brand: string | null; stock: number; unit: string };

export function GoodsReceiptForm({ t, products }: { t: Dictionary; products: Product[] }) {
  const router = useRouter();
  const [rows, setRows] = useState([0]);
  const [next, setNext] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const file = fd.get("file");
      fd.delete("file");
      if (file instanceof File && file.size > 0) {
        fd.set("file_path", await uploadToStorage("goods-receipts", file));
        fd.set("file_name", file.name);
      }
      const res = await createGoodsReceipt(fd);
      if (res?.id) {
        router.push(`/goods-receipts/${res.id}`);
        return;
      }
      setError(res?.error === "invalid" ? t.grNoLines : t.grFailed);
    } catch {
      setError(t.grFailed);
    }
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} className="card flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          {t.grSupplier}
          <input name="supplier" required className="input mt-1" />
        </label>
        <label className="text-sm">
          {t.grReference}
          <input name="reference" className="input mt-1" />
        </label>
        <label className="text-sm">
          {t.date}
          <input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="input mt-1" />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        {rows.map((key) => (
          <div key={key} className="grid items-start gap-2 sm:grid-cols-[minmax(0,1fr)_110px_130px_auto]">
            <ProductPicker products={products} placeholder={t.searchProducts} emptyText={t.noMatches} newText={t.addNewProduct} />
            <input name="qty" type="number" min={1} className="input mt-1" placeholder={t.quantity} />
            <input name="unit_cost" type="number" min={0} step="0.01" className="input mt-1" placeholder={t.unitCost} />
            {rows.length > 1 ? (
              <button type="button" className="mt-2 text-red-600 underline" onClick={() => setRows(rows.filter((r) => r !== key))}>
                {t.remove}
              </button>
            ) : <span />}
          </div>
        ))}
        <button type="button" className="btn-ghost w-fit" onClick={() => { setRows([...rows, next]); setNext(next + 1); }}>
          {t.grAddLine}
        </button>
      </div>

      <label className="text-sm">
        {t.grAttach}
        <input name="file" type="file" accept="application/pdf,image/*" className="input mt-1" />
      </label>
      <label className="text-sm">
        {t.notes}
        <textarea name="note" rows={2} className="input mt-1" />
      </label>

      {error && <p className="text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button disabled={busy} className="btn">{t.save}</button>
        <span className="text-sm text-muted">{t.grSaveHint}</span>
      </div>
    </form>
  );
}
