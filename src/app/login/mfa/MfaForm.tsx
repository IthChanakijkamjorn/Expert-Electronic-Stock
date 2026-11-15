"use client";

import { useActionState } from "react";
import { verifyLoginCode } from "../actions";

export function MfaForm({ labels }: { labels: { code: string; verify: string; invalid: string } }) {
  const [state, action, pending] = useActionState(verifyLoginCode, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input
        name="code"
        required
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        autoFocus
        className="input text-center text-xl tracking-widest"
        placeholder={labels.code}
      />
      {state?.error && <p role="alert" className="text-sm text-red-600">{labels.invalid}</p>}
      <button disabled={pending} className="btn">{labels.verify}</button>
    </form>
  );
}
