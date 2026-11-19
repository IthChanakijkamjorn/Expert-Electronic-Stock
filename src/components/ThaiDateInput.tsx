"use client";

import { useState } from "react";

const MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const ABBR = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const show = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${Number(m[1]) + 543}` : "";
};

// Accepts "19 พฤศจิกายน 2569", "19 พ.ย. 69", "19/11/2569", "2026-11-19"; years above 2400 are Buddhist era.
function parse(text: string): string | null {
  const t = text.trim();
  let d: number, mo: number, y: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  const num = /^(\d{1,2})\s*[/.\-\s]\s*(\d{1,2})\s*[/.\-\s]\s*(\d{2,4})$/.exec(t);
  const word = /^(\d{1,2})\s+(\S+?)\s+(\d{2,4})$/.exec(t);
  if (iso) [y, mo, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (num) [d, mo, y] = [Number(num[1]), Number(num[2]), Number(num[3])];
  else if (word) {
    const i = MONTHS.indexOf(word[2]) >= 0 ? MONTHS.indexOf(word[2]) : ABBR.indexOf(word[2]);
    if (i < 0) return null;
    [d, mo, y] = [Number(word[1]), i + 1, Number(word[3])];
  } else return null;
  if (y < 100) y += 2500;
  if (y > 2400) y -= 543;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

// Shows the date in Thai; the user can type a new one, or pick it from the calendar button.
export function ThaiDateInput({ value, onChange, className }: { value: string; onChange: (iso: string) => void; className: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-1">
      <input
        className={className}
        value={draft ?? show(value)}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== null) {
            const iso = parse(draft);
            if (iso) onChange(iso);
            setDraft(null);
          }
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), (e.target as HTMLInputElement).blur())}
      />
      <label className="relative shrink-0 cursor-pointer px-1 print:hidden">
        📅
        <input type="date" className="absolute inset-0 cursor-pointer opacity-0" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} />
      </label>
    </div>
  );
}
