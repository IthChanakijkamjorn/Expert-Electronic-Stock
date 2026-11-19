"use client";

import { useState } from "react";
import { addUnit, renameUnit, deleteUnit, type Salesperson } from "@/app/(app)/documents/actions";

export const sortUnits = (u: Salesperson[]) => [...u].sort((a, b) => a.name.localeCompare(b.name, "th"));

// Add, rename and remove the units offered in the quantity dropdown.
export function UnitManager({ units, setUnits, onRenamed, label }: { units: Salesperson[]; setUnits: (u: Salesperson[]) => void; onRenamed: (from: string, to: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  return (
    <div className="relative">
      <button type="button" className="btn-ghost" onClick={() => setOpen((o) => !o)}>✎ {label}</button>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 flex w-64 flex-col gap-1 rounded border border-zinc-300 bg-white p-2 text-sm shadow-lg">
          {units.map((u) => (
            <div key={u.id} className="flex items-center gap-1">
              <input className="min-w-0 flex-1 border border-zinc-300 px-1" value={edits[u.id] ?? u.name} onChange={(e) => setEdits({ ...edits, [u.id]: e.target.value })} />
              {edits[u.id] !== undefined && edits[u.id].trim() !== u.name && (
                <button
                  type="button"
                  className="text-navy underline"
                  onClick={async () => {
                    const next = edits[u.id].trim();
                    if (!(await renameUnit(u.id, next))) return;
                    setUnits(sortUnits(units.map((x) => (x.id === u.id ? { ...x, name: next } : x))));
                    onRenamed(u.name, next);
                    setEdits(Object.fromEntries(Object.entries(edits).filter(([k]) => k !== u.id)));
                  }}
                >
                  ✓
                </button>
              )}
              <button
                type="button"
                className="text-red-600"
                onClick={async () => {
                  await deleteUnit(u.id);
                  setUnits(units.filter((x) => x.id !== u.id));
                }}
              >
                ✕
              </button>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <input className="min-w-0 flex-1 border border-zinc-300 px-1" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <button
              type="button"
              className="text-navy underline"
              onClick={async () => {
                const row = await addUnit(draft);
                if (!row) return;
                setUnits(sortUnits([...units, row]));
                setDraft("");
              }}
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
