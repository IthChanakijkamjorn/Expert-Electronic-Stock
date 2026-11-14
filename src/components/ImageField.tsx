"use client";

import { useRef, useState } from "react";
import { uploadToStorage } from "./upload";

export function ImageField({
  label,
  uploadingText,
  failedText,
}: {
  label: string;
  uploadingText: string;
  failedText: string;
}) {
  const [path, setPath] = useState("");
  const [status, setStatus] = useState<"idle" | "busy" | "failed">("idle");
  const ref = useRef<HTMLInputElement>(null);

  async function onChange(file: File | undefined) {
    setPath("");
    if (!file) return setStatus("idle");
    setStatus("busy");
    ref.current?.setCustomValidity(uploadingText); // blocks submit while uploading
    try {
      setPath(await uploadToStorage("covers", file));
      setStatus("idle");
    } catch {
      setStatus("failed");
    }
    ref.current?.setCustomValidity("");
  }

  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        onChange={(e) => onChange(e.target.files?.[0])}
        className="input"
      />
      <input type="hidden" name="image_path" value={path} />
      {status === "busy" && <span className="text-muted">{uploadingText}</span>}
      {status === "failed" && <span className="text-red-600">{failedText}</span>}
    </label>
  );
}
