"use client";

import { useState } from "react";

export default function CompareFill({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/quotations/${id}/compare`, { method: "POST", body: new FormData(e.currentTarget) });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const name = decodeURIComponent(/filename\*=UTF-8''(.+)$/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "compare.xlsx");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-4">
      <h2 className="font-semibold">คู่เทียบ — เติมราคาลงไฟล์ Excel ของบริษัทอื่น</h2>
      <p className="text-sm text-slate-500">
        อัปโหลดไฟล์ .xlsx ของบริษัทนั้น ระบบจะสุ่มราคาต่อหน่วยของแต่ละรายการ ± ตามช่วง % แล้วใส่แทนตามลำดับแถว ที่เหลือคงเดิม กดซ้ำเพื่อสุ่มใหม่
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <input name="file" type="file" accept=".xlsx" required className="input" />
        <label className="text-sm">
          ต่ำสุด %
          <input name="min" type="number" step="0.1" min="0" max="50" defaultValue={5} className="input ml-1 w-20" />
        </label>
        <label className="text-sm">
          สูงสุด %
          <input name="max" type="number" step="0.1" min="0" max="50" defaultValue={10} className="input ml-1 w-20" />
        </label>
        <button className="btn" disabled={busy}>{busy ? "กำลังสร้าง…" : "⬇ สร้างไฟล์"}</button>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{error}</p>}
    </form>
  );
}
