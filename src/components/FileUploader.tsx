"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { uploadToStorage } from "./upload";

export function FileUploader({
  prefix,
  record,
  label,
  uploadingText,
  failedText,
  accept,
  ghost,
}: {
  prefix: string;
  record: (path: string, name: string, size: number) => Promise<void>;
  label: string;
  uploadingText: string;
  failedText: string;
  accept?: string;
  ghost?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "busy" | "failed">("idle");

  async function onChange(files: FileList | null) {
    if (!files?.length) return;
    setStatus("busy");
    try {
      for (const file of Array.from(files)) {
        const path = await uploadToStorage(prefix, file);
        await record(path, file.name, file.size);
      }
      setStatus("idle");
      router.refresh();
    } catch {
      setStatus("failed");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className={`${ghost ? "btn-ghost" : "btn"} w-fit cursor-pointer`}>
        {status === "busy" ? uploadingText : label}
        <input
          type="file"
          multiple
          accept={accept}
          disabled={status === "busy"}
          onChange={(e) => {
            onChange(e.target.files);
            e.target.value = "";
          }}
          className="sr-only"
        />
      </label>
      {status === "failed" && <span className="text-sm text-red-600">{failedText}</span>}
    </div>
  );
}
