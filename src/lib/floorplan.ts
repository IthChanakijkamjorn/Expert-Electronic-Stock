export type Wall = { x1: number; y1: number; x2: number; y2: number };
export type PlanItem = { id: string; product_id: string; x: number; y: number };
export type PlanData = { walls: Wall[]; used: string[]; items: PlanItem[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const num = (v: unknown, max: number) => {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error("bad number");
  return Math.min(max, Math.max(0, Math.round(n * 100) / 100));
};

// Untrusted client JSON -> validated plan data; throws on malformed input.
export function cleanPlanData(raw: unknown, w: number, h: number): PlanData {
  const r = raw as Partial<PlanData>;
  const walls = (r.walls ?? []).slice(0, 500).map((x) => ({ x1: num(x.x1, w), y1: num(x.y1, h), x2: num(x.x2, w), y2: num(x.y2, h) }));
  const items = (r.items ?? []).slice(0, 1000).map((i) => {
    if (!UUID.test(String(i.product_id))) throw new Error("bad product");
    return { id: String(i.id).slice(0, 40), product_id: String(i.product_id), x: num(i.x, w), y: num(i.y, h) };
  });
  const used = [...new Set([...(r.used ?? []), ...items.map((i) => i.product_id)].map(String))].slice(0, 500);
  if (used.some((u) => !UUID.test(u))) throw new Error("bad product");
  return { walls, used, items };
}
