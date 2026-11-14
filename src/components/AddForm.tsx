"use client";

import { useState, useTransition } from "react";

// Server-action form that clears itself (including the image picker) after saving.
export function AddForm({
  action,
  submitLabel,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
  children: React.ReactNode;
}) {
  const [key, setKey] = useState(0);
  const [pending, start] = useTransition();
  return (
    <form
      key={key}
      action={(fd) =>
        start(async () => {
          await action(fd);
          setKey((k) => k + 1);
        })
      }
      className="card flex flex-col gap-3"
    >
      {children}
      <button disabled={pending} className="btn w-fit">
        {submitLabel}
      </button>
    </form>
  );
}
