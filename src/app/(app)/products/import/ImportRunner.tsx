"use client";

import { useState } from "react";
import { importAssets, importSheet, importUpload, listMissing, listSheets, removeProducts, type ImportItem, type SheetResult } from "./actions";
import { publishProduct, triggerWebsiteDeploy } from "../website-actions";

type Labels = { start: string; upload: string; uploadHelp: string; running: string; done: string; failed: string; website: string; removeMissing: string; removeConfirm: string; removeBlocked: string; removed: string };

export function ImportRunner({ labels, isAdmin }: { labels: Labels; isAdmin: boolean }) {
  const [busy, setBusy] = useState(false);
  const [prune, setPrune] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [progress, setProgress] = useState("");
  const add = (m: string) => setLog((l) => [...l, m]);

  // Each source returns its sheet results; photos, datasheets and website publishing are the same for both.
  async function run(load: (report: (name: string, r: SheetResult) => void) => Promise<void>, pruneOthers = false) {
    setBusy(true);
    setLog([]);
    try {
      const all: ImportItem[] = [];
      let clean = true;
      await load((name, r) => {
        add(`${name}: +${r.created} new, ${r.updated} updated`);
        if (r.error) add(`${labels.failed}: ${r.error}`);
        r.warnings.forEach((w) => add(`⚠ ${w}`));
        all.push(...r.items);
        if (r.error || r.warnings.length) clean = false;
      });
      if (pruneOthers) await pruneMissing(all, clean);
      let done = 0;
      let images = 0;
      let sheetsAdded = 0;
      const web = { published: 0, unchanged: 0, removed: 0, skipped: 0 };
      const queue = [...all];
      await Promise.all(
        Array.from({ length: 3 }, async () => {
          while (queue.length) {
            const it = queue.shift()!;
            try {
              const r = await importAssets(it);
              if (r.image === "added") images++;
              if (r.datasheet === "added") sheetsAdded++;
              const w = await publishProduct(it.id);
              if (w.result) web[w.result]++;
              else add(`${labels.failed} (${labels.website}): ${it.brand} ${it.name} — ${w.error}`);
            } catch {
              add(`${labels.failed}: ${it.brand} ${it.name}`);
            }
            setProgress(`${++done} / ${all.length}`);
          }
        }),
      );
      add(`${labels.done}: ${images} images, ${sheetsAdded} datasheets`);
      add(`${labels.website}: ${web.published} published, ${web.unchanged} unchanged, ${web.removed} removed`);
      if (web.published + web.removed > 0) {
        const d = await triggerWebsiteDeploy();
        add(d.ok ? `${labels.website}: deploy started` : `${labels.failed} (${labels.website}): ${d.error}`);
      }
    } catch (e) {
      add(`${labels.failed}: ${e instanceof Error ? e.message : ""}`);
    }
    setProgress("");
    setBusy(false);
  }

  // Only after a clean import: a row that failed would otherwise look "not in the file" and be removed.
  async function pruneMissing(kept: ImportItem[], clean: boolean) {
    if (!clean || !kept.length) return add(`⚠ ${labels.removeBlocked}`);
    const missing = await listMissing(kept.map((i) => i.id));
    if (!missing.length) return add(`${labels.removed}: 0`);
    const list = missing.slice(0, 30).map((p) => `• ${p.name} (${p.stock})`).join("\n") + (missing.length > 30 ? `\n… +${missing.length - 30}` : "");
    if (!window.confirm(`${labels.removeConfirm.replace("{n}", String(missing.length))}\n\n${list}`)) return;
    let n = 0;
    for (let i = 0; i < missing.length; i += 20) {
      n += await removeProducts(missing.slice(i, i + 20).map((p) => p.id));
      setProgress(`${labels.removed} ${n} / ${missing.length}`);
    }
    add(`${labels.removed}: ${n}`);
  }

  const fromGithub = () =>
    run(async (report) => {
      for (const s of await listSheets()) {
        setProgress(s);
        report(s.split("/").pop()!, await importSheet(s));
      }
    });

  const fromFile = (file: File) =>
    run(async (report) => {
      setProgress(file.name);
      const form = new FormData();
      form.set("file", file);
      report(file.name, await importUpload(form));
    }, prune);

  return (
    <div className="card flex flex-col gap-3">
      <button className="btn w-fit" disabled={busy} onClick={fromGithub}>
        {busy ? `${labels.running} ${progress}` : labels.start}
      </button>
      <p className="text-sm text-muted">{labels.uploadHelp}</p>
      {isAdmin && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={prune} disabled={busy} onChange={(e) => setPrune(e.target.checked)} />
          <span>{labels.removeMissing}</span>
        </label>
      )}
      <label className={`btn-ghost w-fit ${busy ? "pointer-events-none opacity-50" : "cursor-pointer"}`}>
        {labels.upload}
        <input
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) fromFile(f);
          }}
        />
      </label>
      {log.length > 0 && (
        <ul className="text-sm text-muted">
          {log.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
