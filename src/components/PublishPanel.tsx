"use client";

import { useState } from "react";
import { publishProject, unpublishProject } from "@/app/(app)/projects/publish";

type Labels = { title: string; help: string; location: string; publish: string; unpublish: string; busy: string; done: string; removed: string; failed: string };

export function PublishPanel({ projectId, photos, labels }: { projectId: string; photos: { id: string; url: string }[]; labels: Labels }) {
  const [sel, setSel] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) => {
    setBusy(true);
    setMsg(labels.busy);
    const r = await fn();
    setMsg(r.ok ? ok : `${labels.failed}: ${r.error ?? ""}`);
    setBusy(false);
  };

  return (
    <div className="card flex flex-col gap-3 p-4">
      <h3 className="font-medium">{labels.title}</h3>
      <p className="text-sm text-muted">{labels.help}</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
        {photos.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => toggle(p.id)}
            className={`relative aspect-square overflow-hidden rounded-xl border-2 ${sel.includes(p.id) ? "border-navy" : "border-transparent"}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" loading="lazy" className="h-full w-full object-cover" />
            {sel.includes(p.id) && <span className="absolute right-1 top-1 rounded-full bg-navy px-1.5 text-xs text-white">{sel.indexOf(p.id) + 1}</span>}
          </button>
        ))}
      </div>
      <input className="input max-w-sm" placeholder={labels.location} value={location} onChange={(e) => setLocation(e.target.value)} />
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn" disabled={busy || !sel.length} onClick={() => run(() => publishProject(projectId, sel, location), labels.done)}>
          {labels.publish} ({sel.length})
        </button>
        <button className="btn-ghost" disabled={busy} onClick={() => run(() => unpublishProject(projectId), labels.removed)}>
          {labels.unpublish}
        </button>
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </div>
    </div>
  );
}
