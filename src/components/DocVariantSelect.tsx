"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { DocVariant } from "@/lib/docType";

// Controlled when `onChange` is given; otherwise stores the choice in the ?doc= URL parameter.
export function DocVariantSelect({
  value,
  onChange,
  label,
}: {
  value: DocVariant;
  onChange?: (v: DocVariant) => void;
  label: string;
}) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const set = (v: DocVariant) => {
    if (onChange) return onChange(v);
    const next = new URLSearchParams(params.toString());
    next.set("doc", v);
    router.replace(`${path}?${next.toString()}`);
  };
  return (
    <label className="flex items-center gap-2 print:hidden">
      <span className="text-muted">{label}</span>
      <select className="input !w-auto" value={value} onChange={(e) => set(e.target.value as DocVariant)}>
        <option value="original">ต้นฉบับ / ORIGINAL</option>
        <option value="copy">สำเนา / COPY OF …</option>
      </select>
    </label>
  );
}
