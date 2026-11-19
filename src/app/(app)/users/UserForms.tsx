"use client";

import { useActionState, useState, useTransition } from "react";
import { createUser, resetPassword, setDisabled, setRole } from "./actions";

type L = Record<string, string>;

export function CreateUserForm({ l }: { l: L }) {
  const [state, action, pending] = useActionState(createUser, null);
  return (
    <form action={action} className="card flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-navy">{l.addUser}</h2>
      <label>{l.username}<input name="username" required className="input mt-1" autoComplete="off" /></label>
      <label>{l.fullName}<input name="full_name" className="input mt-1" /></label>
      <label>{l.password}<input name="password" type="password" minLength={4} required className="input mt-1" autoComplete="new-password" /></label>
      <label>{l.role}
        <select name="role" defaultValue="staff" className="input mt-1">
          <option value="staff">{l.staff}</option>
          <option value="manager">{l.manager}</option>
          <option value="admin">{l.admin}</option>
        </select>
      </label>
      {state?.error && <p className="text-red-600">{l.saveFailed}</p>}
      {state?.ok && <p className="text-green-700">✓</p>}
      <button disabled={pending} className="btn">{l.save}</button>
    </form>
  );
}

export function UserRow({
  id, name, role, disabled, isSelf, l,
}: { id: string; name: string; role: string; disabled: boolean; isSelf: boolean; l: L }) {
  const [pending, start] = useTransition();
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const run = (fn: () => Promise<void>) =>
    start(async () => {
      try { setMsg(""); await fn(); setMsg("✓"); } catch { setMsg(l.saveFailed); }
    });
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <span className={`min-w-40 font-medium ${disabled ? "text-muted line-through" : ""}`}>{name}</span>
      <select
        value={role}
        disabled={isSelf || pending}
        onChange={(e) => run(() => setRole(id, e.target.value))}
        className="input w-auto py-1"
      >
        <option value="staff">{l.staff}</option>
        <option value="manager">{l.manager}</option>
        <option value="admin">{l.admin}</option>
      </select>
      <input
        type="password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        placeholder={l.newPassword}
        autoComplete="new-password"
        className="input w-44 py-1"
      />
      <button
        type="button"
        disabled={pending || pw.length < 4}
        onClick={() => run(async () => { await resetPassword(id, pw); setPw(""); })}
        className="font-semibold text-navy underline disabled:opacity-40"
      >
        {l.resetPassword}
      </button>
      {!isSelf && (
        <button type="button" disabled={pending} onClick={() => run(() => setDisabled(id, !disabled))} className="text-red-600 underline">
          {disabled ? l.enable : l.disable}
        </button>
      )}
      <span className="text-sm text-muted">{msg}</span>
    </li>
  );
}
