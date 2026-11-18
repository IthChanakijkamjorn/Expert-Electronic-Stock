"use client";

import { useState, useTransition } from "react";

export function SlotName({ initial, placeholder, saveLabel, save }: { initial: string; placeholder: string; saveLabel: string; save: (name: string) => Promise<void> }) {
  const [name, setName] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} className="input w-full" />
      <button type="button" className="btn-ghost" disabled={pending || name === initial} onClick={() => start(() => save(name))}>{saveLabel}</button>
    </div>
  );
}
