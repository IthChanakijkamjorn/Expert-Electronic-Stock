"use client";

import Link from "next/link";
import { useState } from "react";

export type DashItem = { href: string; label: string; desc: string; icon: string };
export type DashGroup = { id: string; icon: string; title: string; desc: string; accent: string; badge?: string; items: DashItem[] };

export const DASH_COOKIE = "dash_open";

export function DashboardGroups({ groups, initialOpen, menusLabel }: { groups: DashGroup[]; initialOpen: string[]; menusLabel: string }) {
  const [open, setOpen] = useState<string[]>(initialOpen);

  const toggle = (id: string) =>
    setOpen((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      document.cookie = `${DASH_COOKIE}=${next.join(",")}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });

  return (
    <div className="flex flex-col gap-4">
      {groups.map((g, gi) => {
        const isOpen = open.includes(g.id);
        return (
          <div
            key={g.id}
            className="dash-group dash-in"
            data-open={isOpen}
            style={{ "--accent": g.accent, "--i": gi + 1 } as React.CSSProperties}
          >
            <button type="button" className="dash-head" aria-expanded={isOpen} aria-controls={`dash-${g.id}`} onClick={() => toggle(g.id)}>
              <span className="dash-icon">{g.icon}</span>
              <span className="flex min-w-0 flex-1 flex-col items-start text-left">
                <span className="text-xl font-semibold text-navy sm:text-2xl">{g.title}</span>
                <span className="text-sm text-muted">{g.desc}</span>
              </span>
              {g.badge && <span className="dash-badge">{g.badge}</span>}
              <span className="hidden text-sm text-muted sm:inline">
                {g.items.length} {menusLabel}
              </span>
              <span className="dash-chevron" aria-hidden>
                <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 8l5 5 5-5" />
                </svg>
              </span>
            </button>
            <div id={`dash-${g.id}`} className="dash-body" inert={!isOpen}>
              <div className="min-h-0">
                <div className="grid gap-3 px-4 pb-5 pt-1 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
                  {g.items.map((d, i) => (
                    <Link key={d.href} href={d.href} className="dash-item" style={{ "--j": i } as React.CSSProperties}>
                      <span className="dash-item-icon">{d.icon}</span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-semibold text-navy">{d.label}</span>
                        <span className="text-xs text-muted">{d.desc}</span>
                      </span>
                      <span className="arrow-chip !h-8 !w-8 shrink-0">→</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
