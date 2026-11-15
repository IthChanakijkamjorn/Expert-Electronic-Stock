"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { confirmEnroll, disableTwoFactor, startEnroll } from "./actions";

type Labels = {
  on: string; off: string; enable: string; disable: string; scan: string; manual: string;
  code: string; verify: string; invalid: string;
};

export function TwoFactor({ factorId, labels }: { factorId: string | null; labels: Labels }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [setup, setSetup] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [bad, setBad] = useState(false);

  if (factorId) {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <span className="pill bg-emerald-100 text-emerald-700">{labels.on}</span>
        <button
          disabled={pending}
          className="btn-ghost"
          onClick={() => start(async () => { await disableTwoFactor(factorId); router.refresh(); })}
        >
          {labels.disable}
        </button>
      </div>
    );
  }

  if (!setup) {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <span className="pill bg-amber-100 text-amber-700">{labels.off}</span>
        <button
          disabled={pending}
          className="btn"
          onClick={() => start(async () => setSetup(await startEnroll()))}
        >
          {labels.enable}
        </button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col items-start gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const code = String(new FormData(e.currentTarget).get("code"));
        start(async () => {
          const ok = await confirmEnroll(setup.factorId, code);
          setBad(!ok);
          if (ok) { setSetup(null); router.refresh(); }
        });
      }}
    >
      <p>{labels.scan}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={setup.qr} alt="QR" width={180} height={180} className="rounded-lg border border-zinc-300 bg-white" />
      <p className="text-sm text-muted">{labels.manual}: <span className="font-mono">{setup.secret}</span></p>
      <input name="code" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} className="input w-48 text-center tracking-widest" placeholder={labels.code} />
      {bad && <p className="text-sm text-red-600">{labels.invalid}</p>}
      <button disabled={pending} className="btn">{labels.verify}</button>
    </form>
  );
}
