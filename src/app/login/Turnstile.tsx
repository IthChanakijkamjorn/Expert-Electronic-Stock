"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

// Cloudflare Turnstile; the token is posted in the hidden "captcha" field.
// Without a site key (local dev) nothing is rendered and Supabase captcha must be off.
export function Turnstile({ resetSignal }: { resetSignal: unknown }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string>(undefined);
  const [token, setToken] = useState("");

  useEffect(() => {
    if (!SITE_KEY || !box.current) return;
    const mount = () => {
      if (!window.turnstile || !box.current || widget.current) return;
      widget.current = window.turnstile.render(box.current, {
        sitekey: SITE_KEY,
        callback: setToken,
        "expired-callback": () => setToken(""),
        "error-callback": () => setToken(""),
      });
    };
    if (window.turnstile) return mount();
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = mount;
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    // A token is single-use, so get a fresh one after every attempt.
    if (widget.current) {
      window.turnstile?.reset(widget.current);
      setToken("");
    }
  }, [resetSignal]);

  if (!SITE_KEY) return null;
  return (
    <>
      <div ref={box} />
      <input type="hidden" name="captcha" value={token} />
    </>
  );
}
