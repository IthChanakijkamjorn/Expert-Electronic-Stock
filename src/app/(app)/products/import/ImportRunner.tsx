"use client";

import { useState } from "react";
import { importAssets, importSheet, listSheets, type ImportItem } from "./actions";

type Labels = { start: string; running: string; done: string; failed: string };

export function ImportRunner({ labels }: { labels: Labels }) {
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [progress, setProgress] = useState("");
  const add = (m: string) => setLog((l) => [...l, m]);

  async function run() {
    setBusy(true);
    setLog([]);
    try {
      const sheets = await listSheets();
      const all: ImportItem[] = [];
      for (const s of sheets) {
        setProgress(s);
        const r = await importSheet(s);
        add(`${s.split("/").pop()}: +${r.created} new, ${r.updated} updated`);
        if (r.error) add(`${labels.failed}: ${r.error}`);
        r.warnings.forEach((w) => add(`⚠ ${w}`));
        all.push(...r.items);
      }
      let done = 0;
      let images = 0;
      let sheetsAdded = 0;
      const queue = [...all];
      await Promise.all(
        Array.from({ length: 3 }, async () => {
          while (queue.length) {
            const it = queue.shift()!;
            try {
              const r = await importAssets(it);
              if (r.image === "added") images++;
              if (r.datasheet === "added") sheetsAdded++;
            } catch {
              add(`${labels.failed}: ${it.brand} ${it.name}`);
            }
            setProgress(`${++done} / ${all.length}`);
          }
        }),
      );
      add(`${labels.done}: ${images} images, ${sheetsAdded} datasheets`);
    } catch (e) {
      add(`${labels.failed}: ${e instanceof Error ? e.message : ""}`);
    }
    setProgress("");
    setBusy(false);
  }

  return (
    <div className="card flex flex-col gap-3">
      <button className="btn w-fit" disabled={busy} onClick={run}>
        {busy ? `${labels.running} ${progress}` : labels.start}
      </button>
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
