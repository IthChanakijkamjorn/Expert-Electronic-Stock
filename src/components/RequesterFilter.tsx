import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/dictionaries";

// Chips to view one person's documents; `r` is the selected tag ("" = everyone, "-" = untagged).
export function RequesterFilter({ rows, selected, base, t }: { rows: { requester: string | null }[]; selected: string; base: string; t: Dictionary }) {
  const counts = new Map<string, number>();
  rows.forEach((r) => { const k = r.requester?.trim() || "-"; counts.set(k, (counts.get(k) ?? 0) + 1); });
  if (![...counts.keys()].some((k) => k !== "-")) return null;
  const names = [...counts.keys()].filter((k) => k !== "-").sort((a, b) => a.localeCompare(b, "th"));
  const chip = (key: string, label: string, n: number) => (
    <Link key={key} href={key ? `${base}?r=${encodeURIComponent(key)}` : base} className={selected === key ? "btn" : "btn-ghost"}>
      {label} ({n})
    </Link>
  );
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted">{t.requester}:</span>
      {chip("", t.requesterAll, rows.length)}
      {names.map((n) => chip(n, n, counts.get(n)!))}
      {counts.has("-") && chip("-", t.requesterNone, counts.get("-")!)}
    </div>
  );
}

export const byRequester = <T extends { requester: string | null }>(rows: T[], sel: string) =>
  sel ? rows.filter((r) => (r.requester?.trim() || "-") === sel) : rows;
