"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const IDLE_MS = 60 * 60 * 1000;
const KEY = "last_activity";

// Signs out after an hour without real activity in any tab, including when the tab was left open or closed and reopened.
export default function IdleLogout() {
  useEffect(() => {
    const stored = Number(localStorage.getItem(KEY));
    if (stored && Date.now() - stored > IDLE_MS) void logout();
    else localStorage.setItem(KEY, String(Date.now()));

    let lastWrite = 0;
    const touch = () => {
      const now = Date.now();
      if (now - lastWrite > 5000) {
        lastWrite = now;
        localStorage.setItem(KEY, String(now));
      }
    };
    const check = () => {
      const last = Number(localStorage.getItem(KEY));
      if (last && Date.now() - last > IDLE_MS) void logout();
    };
    async function logout() {
      localStorage.removeItem(KEY);
      await createClient().auth.signOut();
      window.location.href = "/login";
    }
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    document.addEventListener("visibilitychange", check);
    const timer = setInterval(check, 30000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      document.removeEventListener("visibilitychange", check);
      clearInterval(timer);
    };
  }, []);
  return null;
}
