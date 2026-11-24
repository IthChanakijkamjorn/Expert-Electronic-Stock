"use client";

import { useState } from "react";
import type { QuoteLine } from "@/lib/quotation";

export type CompareSource = { id: string; label: string; lines: QuoteLine[] };
type Row = { brand: string; model: string; name: string; unit: string; qty: string; price: string };

const toRows = (lines: QuoteLine[]): Row[] =>
  lines.map((l) => ({ brand: l.brand ?? "", model: l.model ?? "", name: l.name ?? "", unit: l.unit ?? "", qty: String(l.qty ?? ""), price: String(l.price ?? "") }));
const empty: Row = { brand: "", model: "", name: "", unit: "", qty: "1", price: "" };

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function CompareFill({ initialLines, sources }: { initialLines?: QuoteLine[]; sources?: CompareSource[] }) {
  const [rows, setRows] = useState<Row[]>(() => toRows(initialLines ?? []));
  const [mode, setMode] = useState<"quote" | "file">(initialLines || sources?.length ? "quote" : "file");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<string[]>([]);
  const [forms, setForms] = useState<File[]>([]);
  const [min, setMin] = useState("5");
  const [max, setMax] = useState("10");

  const set = (i: number, k: keyof Row, v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  async function extract(file: File | undefined) {
    if (!file) return;
    setBusy("กำลังอ่านไฟล์…");
    setError("");
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/quotations/compare/extract", { method: "POST", body: fd });
      if (!res.ok) return setError(await res.text());
      const { lines } = (await res.json()) as { lines: QuoteLine[] };
      setRows(toRows(lines));
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setBusy("");
    }
  }

  async function fill() {
    const lines = rows
      .map((r) => ({ brand: r.brand.trim(), model: r.model.trim(), name: r.name.trim(), unit: r.unit.trim(), qty: Number(r.qty) || 0, price: Number(r.price) || 0 }))
      .filter((l) => l.name || l.model || l.brand);
    if (!lines.length) return setError("ไม่มีรายการสินค้า");
    if (!forms.length) return setError("กรุณาเลือกไฟล์ฟอร์ม Excel ของบริษัทอย่างน้อย 1 ไฟล์");
    setError("");
    setDone([]);
    const errors: string[] = [];
    for (const f of forms) {
      setBusy(`กำลังสร้าง ${f.name}…`);
      try {
        const fd = new FormData();
        fd.set("file", f);
        fd.set("lines", JSON.stringify(lines));
        fd.set("min", min);
        fd.set("max", max);
        const res = await fetch("/quotations/compare/fill", { method: "POST", body: fd });
        if (!res.ok) {
          errors.push(`${f.name}: ${await res.text()}`);
          continue;
        }
        const name = decodeURIComponent(/filename\*=UTF-8''(.+)$/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "compare.xlsx");
        download(await res.blob(), name);
        setDone((d) => [...d, name]);
      } catch {
        errors.push(`${f.name}: เชื่อมต่อเซิร์ฟเวอร์ไม่ได้`);
      }
    }
    setBusy("");
    setError(errors.join("\n"));
  }

  const total = rows.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.price) || 0), 0);

  return (
    <div className="card space-y-4 p-4">
      <div>
        <h2 className="font-semibold">คู่เทียบ — คัดลอกรายการสินค้าลงฟอร์ม Excel ของบริษัทอื่น</h2>
        <p className="text-sm text-slate-500">
          1) เลือกแหล่งรายการสินค้า แล้วตรวจ/แก้ในตาราง 2) อัปโหลดฟอร์ม .xlsx ของแต่ละบริษัท ระบบจะใส่รายการ (เพิ่มแถวให้ถ้าไม่พอ) สุ่มราคาต่อหน่วย ± ตามช่วง % และคำนวณยอดรวม/VAT ให้ กดซ้ำเพื่อสุ่มใหม่
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">1. แหล่งรายการสินค้า</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          {(initialLines || sources?.length) && (
            <label className="flex items-center gap-1">
              <input type="radio" checked={mode === "quote"} onChange={() => setMode("quote")} /> ใบเสนอราคาในระบบ
            </label>
          )}
          <label className="flex items-center gap-1">
            <input type="radio" checked={mode === "file"} onChange={() => setMode("file")} /> อัปโหลดไฟล์ (Excel / PDF / CSV)
          </label>
        </div>
        {mode === "quote" && sources?.length ? (
          <select className="input" defaultValue="" onChange={(e) => setRows(toRows(sources.find((s) => s.id === e.target.value)?.lines ?? []))}>
            <option value="" disabled>— เลือกใบเสนอราคา —</option>
            {sources.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        ) : mode === "quote" && initialLines ? (
          <button type="button" className="btn-ghost text-sm" onClick={() => setRows(toRows(initialLines))}>↺ ใช้รายการจากใบเสนอราคานี้</button>
        ) : (
          <div className="space-y-1">
            <input type="file" accept=".xlsx,.pdf,.csv" className="input" disabled={!!busy} onChange={(e) => extract(e.target.files?.[0])} />
            <p className="text-xs text-slate-500">แม่นยำที่สุด: Excel (.xlsx) · PDF ต้องเป็นไฟล์ที่สร้างจากโปรแกรม (ไม่ใช่ภาพสแกน) · ต้องมีหัวตาราง เช่น รายการ / จำนวน / ราคาต่อหน่วย</p>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="data-table w-full text-left text-sm">
          <thead>
            <tr>
              <th className="py-1 pr-2">#</th><th className="pr-2">ยี่ห้อ</th><th className="pr-2">รุ่น</th><th className="pr-2">รายการ</th>
              <th className="pr-2">จำนวน</th><th className="pr-2">หน่วย</th><th className="pr-2">ราคาต่อหน่วย</th><th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-zinc-100 align-top">
                <td className="py-1 pr-2">{i + 1}</td>
                <td className="pr-2"><input className="input w-28" value={r.brand} onChange={(e) => set(i, "brand", e.target.value)} /></td>
                <td className="pr-2"><input className="input w-32" value={r.model} onChange={(e) => set(i, "model", e.target.value)} /></td>
                <td className="pr-2"><textarea className="input min-w-64 w-full" rows={1} value={r.name} onChange={(e) => set(i, "name", e.target.value)} /></td>
                <td className="pr-2"><input className="input w-20" type="number" min="0" step="any" value={r.qty} onChange={(e) => set(i, "qty", e.target.value)} /></td>
                <td className="pr-2"><input className="input w-20" value={r.unit} onChange={(e) => set(i, "unit", e.target.value)} /></td>
                <td className="pr-2"><input className="input w-28" type="number" min="0" step="any" value={r.price} onChange={(e) => set(i, "price", e.target.value)} /></td>
                <td><button type="button" className="btn-ghost" title="ลบ" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          <button type="button" className="btn-ghost" onClick={() => setRows((rs) => [...rs, { ...empty }])}>+ เพิ่มแถว</button>
          {rows.length > 0 && <button type="button" className="btn-ghost" onClick={() => setRows([])}>ล้างทั้งหมด</button>}
          <span className="ml-auto text-slate-500">{rows.length} รายการ · รวม {total.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท (ก่อนสุ่ม/VAT)</span>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">2. ฟอร์ม Excel ของบริษัทคู่เทียบ (.xlsx เลือกได้หลายไฟล์)</h3>
        <div className="flex flex-wrap items-end gap-3">
          <input type="file" accept=".xlsx" multiple className="input" onChange={(e) => setForms(Array.from(e.target.files ?? []))} />
          <label className="text-sm">
            สุ่ม ± ต่ำสุด %
            <input type="number" step="0.1" min="0" max="50" value={min} onChange={(e) => setMin(e.target.value)} className="input ml-1 w-20" />
          </label>
          <label className="text-sm">
            สูงสุด %
            <input type="number" step="0.1" min="0" max="50" value={max} onChange={(e) => setMax(e.target.value)} className="input ml-1 w-20" />
          </label>
          <button type="button" className="btn" disabled={!!busy || !rows.length || !forms.length} onClick={fill}>⬇ สร้างไฟล์</button>
        </div>
      </div>

      {busy && <p className="text-sm text-slate-500">{busy}</p>}
      {done.length > 0 && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700">ดาวน์โหลดแล้ว: {done.join(", ")}</p>}
      {error && <p className="whitespace-pre-line rounded-lg bg-red-50 px-3 py-2 text-red-700">{error}</p>}
    </div>
  );
}
