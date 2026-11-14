"use client";

import { useActionState } from "react";
import { signIn } from "./actions";

type Labels = {
  email: string;
  password: string;
  login: string;
  invalidCredentials: string;
};

export function LoginForm({ labels }: { labels: Labels }) {
  const [state, action, pending] = useActionState(signIn, null);
  const input = "w-full rounded border border-zinc-300 px-3 py-2";
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        {labels.email}
        <input name="email" type="text" required autoComplete="username" autoCapitalize="none" className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {labels.password}
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={input}
        />
      </label>
      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {labels.invalidCredentials}
        </p>
      )}
      <button
        disabled={pending}
        className="rounded bg-zinc-900 px-3 py-2 text-white disabled:opacity-50"
      >
        {labels.login}
      </button>
    </form>
  );
}
