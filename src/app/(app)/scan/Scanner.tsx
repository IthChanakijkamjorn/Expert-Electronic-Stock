"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { resolveScan } from "./actions";

export function Scanner({ labels }: { labels: { start: string; stop: string; manual: string; go: string; notFound: string; cameraError: string } }) {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const busy = useRef(false);
  const [on, setOn] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handle = async (text: string) => {
    if (busy.current) return;
    busy.current = true;
    const id = await resolveScan(text);
    if (id) {
      stopRef.current?.();
      router.push(`/products/${id}`);
    } else {
      setMsg(`${labels.notFound}: ${text}`);
      setTimeout(() => (busy.current = false), 1500);
    }
  };

  useEffect(() => {
    if (!on) return;
    let cancelled = false;
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(undefined, video.current!, (result) => {
          if (result) void handle(result.getText());
        });
        if (cancelled) controls.stop();
        else stopRef.current = () => controls.stop();
      } catch {
        setMsg(labels.cameraError);
        setOn(false);
      }
    })();
    return () => {
      cancelled = true;
      stopRef.current?.();
      stopRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex flex-col gap-3 p-4">
        <video ref={video} className={`w-full max-w-md rounded-xl bg-black ${on ? "" : "hidden"}`} playsInline muted />
        <button type="button" className="btn w-fit" onClick={() => { setMsg(null); setOn((v) => !v); }}>
          {on ? labels.stop : labels.start}
        </button>
      </div>
      <form
        className="card flex gap-2 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem("code") as HTMLInputElement;
          busy.current = false;
          void handle(input.value);
        }}
      >
        <input name="code" className="input" placeholder={labels.manual} autoComplete="off" />
        <button className="btn">{labels.go}</button>
      </form>
      {msg && <p className="text-red-600">{msg}</p>}
    </div>
  );
}
