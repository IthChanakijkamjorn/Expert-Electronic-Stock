"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { uploadToStorage } from "./upload";

export function ImageUploader({
  prefix,
  record,
  label,
  failedText,
}: {
  prefix: string;
  record: (path: string) => Promise<void>;
  label: string;
  failedText: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "busy" | "failed">("idle");

  async function onChange(file: File | undefined) {
    if (!file) return;
    setStatus("busy");
    try {
      await record(await uploadToStorage(prefix, file));
      setStatus("idle");
      router.refresh();
    } catch {
      setStatus("failed");
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <label className="inline-flex w-fit cursor-pointer rounded-full border border-[#cfc9dc] bg-white px-3 py-1 text-xs font-semibold text-navy transition hover:bg-navy hover:text-white">
        {status === "busy" ? "…" : label}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          disabled={status === "busy"}
          onChange={(e) => {
            onChange(e.target.files?.[0]);
            e.target.value = "";
          }}
          className="sr-only"
        />
      </label>
      {status === "failed" && <span className="text-xs text-red-600">{failedText}</span>}
    </span>
  );
}
