"use client";

import { useState } from "react";
import { addSalesperson, deleteSalesperson, renameSalesperson, type Salesperson } from "@/app/(app)/documents/actions";

type Api = {
  add: (name: string) => Promise<Salesperson | null>;
  rename: (id: string, name: string) => Promise<boolean>;
  remove: (id: string) => Promise<unknown>;
};
const salesApi: Api = { add: addSalesperson, rename: renameSalesperson, remove: deleteSalesperson };

// Dropdown of saved sales names with a small manager to add, rename and remove them.
export function SalesPicker({
  initial,
  value,
  onChange,
  labels,
  api = salesApi,
}: {
  api?: Api;
  initial: Salesperson[];
  value: string;
  onChange: (v: string) => void;
  labels: { add: string; remove: string; save: string; confirm: string };
}) {
  const [names, setNames] = useState(initial);
  const [manage, setManage] = useState(false);
  const [draft, setDraft] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const inList = names.some((n) => n.name === value);

  return (
    <div className="print:hidden">
      <div className="flex items-center gap-1">
        <select className="w-full bg-[#f0f8ff] px-1 py-0.5" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value=""></option>
          {value && !inList && <option value={value}>{value}</option>}
          {names.map((n) => <option key={n.id} value={n.name}>{n.name}</option>)}
        </select>
        <button type="button" className="shrink-0 px-1" onClick={() => setManage((m) => !m)}>✎</button>
      </div>
      {manage && (
        <div className="mt-1 flex flex-col gap-1 rounded border border-zinc-300 bg-white p-2">
          {names.map((n) => (
            <div key={n.id} className="flex items-center gap-1">
              <input
                className="min-w-0 flex-1 border border-zinc-300 px-1"
                value={edits[n.id] ?? n.name}
                onChange={(e) => setEdits({ ...edits, [n.id]: e.target.value })}
              />
              {edits[n.id] !== undefined && edits[n.id] !== n.name && (
                <button
                  type="button"
                  className="text-navy underline"
                  onClick={async () => {
                    const next = edits[n.id].trim();
                    if (!(await api.rename(n.id, next))) return;
                    setNames(names.map((x) => (x.id === n.id ? { ...x, name: next } : x)));
                    if (value === n.name) onChange(next);
                    setEdits((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== n.id)));
                  }}
                >
                  {labels.save}
                </button>
              )}
              <button
                type="button"
                className="text-red-600 underline"
                onClick={async () => {
                  if (!confirm(labels.confirm)) return;
                  await api.remove(n.id);
                  setNames(names.filter((x) => x.id !== n.id));
                }}
              >
                {labels.remove}
              </button>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <input className="min-w-0 flex-1 border border-zinc-300 px-1" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <button
              type="button"
              className="text-navy underline"
              onClick={async () => {
                const row = await api.add(draft);
                if (!row) return;
                setNames([...names, row].sort((a, b) => a.name.localeCompare(b.name)));
                onChange(row.name);
                setDraft("");
              }}
            >
              {labels.add}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
