"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { savePlan } from "./actions";
import { BrandPicker } from "@/components/BrandPicker";
import type { PlanData, PlanItem, Wall } from "@/lib/floorplan";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type Product = { id: string; name: string; sku: string | null; brand: string | null; unit: string };
type Sel = { kind: "item" | "wall"; id: string | number } | null;
const MARGIN = 1;
const snap = (v: number) => Math.round(v * 10) / 10;

export function PlanEditor({
  t,
  id,
  initial,
  products,
  imageUrls,
  projects,
}: {
  t: Dictionary;
  id: string | null;
  initial: { name: string; width: number; height: number; projectId: string; data: PlanData };
  products: Product[];
  imageUrls: Record<string, string>;
  projects: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(savePlan.bind(null, id), null);
  const [name, setName] = useState(initial.name);
  const [w, setW] = useState(String(initial.width));
  const [h, setH] = useState(String(initial.height));
  const [projectId, setProjectId] = useState(initial.projectId);
  const [walls, setWalls] = useState<Wall[]>(initial.data.walls);
  const [items, setItems] = useState<PlanItem[]>(initial.data.items);
  const [used, setUsed] = useState<string[]>(initial.data.used);
  const [tool, setTool] = useState<"select" | "wall">("select");
  const [sel, setSel] = useState<Sel>(null);
  const [draft, setDraft] = useState<Wall | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<string | null>(null);

  const W = Math.max(1, Number(w) || 1);
  const H = Math.max(1, Number(h) || 1);
  const r = Math.max(0.3, Math.max(W, H) / 40);
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const number = (pid: string) => used.indexOf(pid) + 1;

  const point = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!;
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const q = p.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: Math.min(W, Math.max(0, q.x)), y: Math.min(H, Math.max(0, q.y)) };
  };

  const addUsed = (pid: string) => setUsed((u) => (u.includes(pid) ? u : [...u, pid]));
  const place = (pid: string, x: number, y: number) => {
    addUsed(pid);
    const item = { id: crypto.randomUUID(), product_id: pid, x, y };
    setItems((l) => [...l, item]);
    setSel({ kind: "item", id: item.id });
  };
  const removeSel = () => {
    if (!sel) return;
    if (sel.kind === "item") setItems((l) => l.filter((i) => i.id !== sel.id));
    else setWalls((l) => l.filter((_, i) => i !== sel.id));
    setSel(null);
  };
  const removeProduct = (pid: string) => {
    setUsed((u) => u.filter((x) => x !== pid));
    setItems((l) => l.filter((i) => i.product_id !== pid));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if ((e.key === "Delete" || e.key === "Backspace") && tag !== "INPUT" && tag !== "SELECT" && sel) {
        e.preventDefault();
        removeSel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onDown = (e: React.PointerEvent) => {
    if (tool === "wall") {
      const p = point(e);
      setDraft({ x1: snap(p.x), y1: snap(p.y), x2: snap(p.x), y2: snap(p.y) });
      svgRef.current!.setPointerCapture(e.pointerId);
    } else if (e.target === svgRef.current || (e.target as Element).getAttribute("data-bg")) {
      setSel(null);
    }
  };
  const onMove = (e: React.PointerEvent) => {
    if (draft) {
      const p = point(e);
      setDraft({ ...draft, x2: snap(p.x), y2: snap(p.y) });
    } else if (drag.current) {
      const p = point(e);
      setItems((l) => l.map((i) => (i.id === drag.current ? { ...i, x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 } : i)));
    }
  };
  const onUp = () => {
    if (draft && (draft.x1 !== draft.x2 || draft.y1 !== draft.y2)) setWalls((l) => [...l, draft]);
    setDraft(null);
    drag.current = null;
  };

  const counts = new Map<string, number>();
  items.forEach((i) => counts.set(i.product_id, (counts.get(i.product_id) ?? 0) + 1));
  const data: PlanData = { walls, items, used };
  const grid = [];
  for (let x = 0; x <= W; x += 1) grid.push(<line key={`x${x}`} x1={x} y1={0} x2={x} y2={H} stroke="#e4e4e7" strokeWidth={0.02} />);
  for (let y = 0; y <= H; y += 1) grid.push(<line key={`y${y}`} x1={0} y1={y} x2={W} y2={y} stroke="#e4e4e7" strokeWidth={0.02} />);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="width_m" value={w} />
      <input type="hidden" name="height_m" value={h} />
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="data" value={JSON.stringify(data)} />

      <div className="card flex flex-wrap items-end gap-4">
        <label className="text-sm">
          {t.name}
          <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="text-sm">
          {t.fpWidth}
          <input type="number" min={1} max={500} step="0.1" className="input mt-1 w-28" value={w} onChange={(e) => setW(e.target.value)} />
        </label>
        <label className="text-sm">
          {t.fpHeight}
          <input type="number" min={1} max={500} step="0.1" className="input mt-1 w-28" value={h} onChange={(e) => setH(e.target.value)} />
        </label>
        {projects.length > 0 && (
          <label className="text-sm">
            {t.projects}
            <select className="input mt-1" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">{t.noProject}</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
        )}
        <div className="flex gap-2">
          <button type="button" className={tool === "select" ? "btn" : "btn-ghost"} onClick={() => setTool("select")}>↖ {t.fpSelect}</button>
          <button type="button" className={tool === "wall" ? "btn" : "btn-ghost"} onClick={() => setTool("wall")}>▭ {t.fpWall}</button>
          <button type="button" className="btn-ghost" disabled={!sel} onClick={removeSel}>🗑 {t.fpRemove}</button>
        </div>
        <div className="ml-auto flex gap-2">
          {id && <a href={`/floorplans/${id}/pdf`} target="_blank" className="btn-ghost">PDF</a>}
          <button className="btn" disabled={pending}>{t.save}</button>
        </div>
        <p className="w-full text-sm text-muted">{t.fpHelp}</p>
        {state?.error && <p className="w-full text-red-600">{t.saveFailed}</p>}
        {state?.ok && <p className="w-full text-emerald-700">{t.docSaved}</p>}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_320px]">
        <div className="card overflow-auto p-2">
          <svg
            ref={svgRef}
            viewBox={`${-MARGIN} ${-MARGIN} ${W + 2 * MARGIN} ${H + 2 * MARGIN}`}
            className={`w-full touch-none select-none bg-white ${tool === "wall" ? "cursor-crosshair" : ""}`}
            style={{ aspectRatio: `${W + 2 * MARGIN} / ${H + 2 * MARGIN}` }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const pid = e.dataTransfer.getData("text/product");
              if (byId.has(pid)) {
                const p = point(e);
                place(pid, Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100);
              }
            }}
          >
            <rect data-bg="1" x={0} y={0} width={W} height={H} fill="#fff" />
            {grid}
            <rect x={0} y={0} width={W} height={H} fill="none" stroke="#111" strokeWidth={0.12} pointerEvents="none" />
            <text x={0} y={-0.15} fontSize={0.35} fill="#52525b">{W} m</text>
            <text x={W + 0.1} y={H / 2} fontSize={0.35} fill="#52525b">{H} m</text>
            {walls.map((l, i) => (
              <g key={i} onPointerDown={(e) => { if (tool === "select") { e.stopPropagation(); setSel({ kind: "wall", id: i }); } }}>
                <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="transparent" strokeWidth={0.4} />
                <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={sel?.kind === "wall" && sel.id === i ? "#2563eb" : "#111"} strokeWidth={0.12} strokeLinecap="round" />
              </g>
            ))}
            {draft && <line x1={draft.x1} y1={draft.y1} x2={draft.x2} y2={draft.y2} stroke="#2563eb" strokeWidth={0.1} strokeDasharray="0.2" />}
            {items.map((i) => {
              const url = imageUrls[i.product_id];
              const active = sel?.kind === "item" && sel.id === i.id;
              return (
                <g
                  key={i.id}
                  className={tool === "select" ? "cursor-move" : ""}
                  onPointerDown={(e) => {
                    if (tool !== "select") return;
                    e.stopPropagation();
                    setSel({ kind: "item", id: i.id });
                    drag.current = i.id;
                    svgRef.current!.setPointerCapture(e.pointerId);
                  }}
                >
                  <title>{byId.get(i.product_id)?.name}</title>
                  <clipPath id={`c${i.id}`}><circle cx={i.x} cy={i.y} r={r} /></clipPath>
                  <circle cx={i.x} cy={i.y} r={r} fill="#eef2ff" stroke={active ? "#2563eb" : "#475569"} strokeWidth={active ? 0.1 : 0.05} />
                  {url ? (
                    <image href={url} x={i.x - r} y={i.y - r} width={2 * r} height={2 * r} preserveAspectRatio="xMidYMid slice" clipPath={`url(#c${i.id})`} />
                  ) : (
                    <text x={i.x} y={i.y + r * 0.35} fontSize={r} textAnchor="middle">📦</text>
                  )}
                  <circle cx={i.x + r * 0.8} cy={i.y - r * 0.8} r={r * 0.45} fill="#1e3a8a" />
                  <text x={i.x + r * 0.8} y={i.y - r * 0.8 + r * 0.17} fontSize={r * 0.55} fill="#fff" textAnchor="middle" fontWeight="bold">{number(i.product_id)}</text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="card flex flex-col gap-3 p-3">
          <h2 className="font-semibold">{t.fpProducts}</h2>
          <BrandPicker
            products={products}
            placeholder={`+ ${t.invAddItem}`}
            emptyText={t.noMatches}
            noBrandText={t.invNoBrand}
            allowOver
            onPick={(p) => addUsed(p.id)}
          />
          <ul className="flex max-h-[60vh] flex-col gap-2 overflow-auto">
            {used.map((pid) => {
              const p = byId.get(pid);
              if (!p) return null;
              return (
                <li
                  key={pid}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/product", pid)}
                  className="flex cursor-grab items-center gap-2 rounded-lg border border-zinc-200 p-2"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">{number(pid)}</span>
                  {imageUrls[pid] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrls[pid]} alt="" className="h-12 w-12 shrink-0 rounded object-cover" draggable={false} />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-zinc-100 text-xl">📦</span>
                  )}
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block truncate font-semibold">{p.name}</span>
                    <span className="block truncate text-muted">{[p.brand, p.sku].filter(Boolean).join(" · ")}</span>
                    <span className="text-muted">{t.fpPlaced}: {counts.get(pid) ?? 0}</span>
                  </span>
                  <button type="button" title={t.fpPlaceHere} className="btn-ghost !px-2" onClick={() => place(pid, W / 2, H / 2)}>＋</button>
                  <button type="button" className="text-red-600" onClick={() => removeProduct(pid)}>✕</button>
                </li>
              );
            })}
            {used.length === 0 && <li className="text-sm text-muted">{t.fpNoProducts}</li>}
          </ul>
        </div>
      </div>
    </form>
  );
}
