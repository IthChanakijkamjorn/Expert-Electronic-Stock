"use client";

import { useEffect, useRef, useState } from "react";
import { simplifyLoop, toDxf, traceMask, type Pt } from "@/lib/trace";

const MAXPX = 500;

export default function CadTracer({ th }: { th: boolean }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [name, setName] = useState("product");
  const [threshold, setThreshold] = useState(40);
  const [detail, setDetail] = useState(1.5);
  const [levels, setLevels] = useState(6);
  const [minLen, setMinLen] = useState(30);
  const [width, setWidth] = useState(300);
  const [loops, setLoops] = useState<Pt[][]>([]);
  const [size, setSize] = useState({ w: 1, h: 1 });
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!img || !canvas.current) return;
    const s = Math.min(1, MAXPX / Math.max(img.width, img.height));
    const w = Math.max(2, Math.round(img.width * s)), h = Math.max(2, Math.round(img.height * s));
    const c = canvas.current;
    c.width = w; c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    // Background colour = average of the image border.
    let r = 0, g = 0, b = 0, n = 0;
    const edge = (x: number, y: number) => { const i = (y * w + x) * 4; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; };
    for (let x = 0; x < w; x++) { edge(x, 0); edge(x, h - 1); }
    for (let y = 0; y < h; y++) { edge(0, y); edge(w - 1, y); }
    r /= n; g /= n; b /= n;
    const mask = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const dist = Math.hypot(d[i * 4] - r, d[i * 4 + 1] - g, d[i * 4 + 2] - b);
      mask[i] = dist > threshold * 2 ? 1 : 0;
    }
    // Grey image, lightly blurred, then contour lines at several brightness levels capture inner detail.
    let gray = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) gray[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    for (let pass = 0; pass < 2; pass++) {
      const nb = new Float32Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let sum = 0, c = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < w && yy < h) { sum += gray[yy * w + xx]; c++; }
        }
        nb[y * w + x] = sum / c;
      }
      gray = nb;
    }
    const sets: Uint8Array[] = [mask];
    for (let k = 1; k <= levels; k++) {
      const lv = 15 + ((235 - 15) * k) / (levels + 1);
      const m = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) m[i] = mask[i] && gray[i] < lv ? 1 : 0;
      sets.push(m);
    }
    const found = sets
      .flatMap((m) => traceMask(m, w, h))
      .filter((l) => l.length > minLen)
      .map((l) => simplifyLoop(l, detail))
      .filter((l) => l.length >= 3);
    setLoops(found);
    setSize({ w, h });
  }, [img, threshold, detail, levels, minLen]);

  function load(f: File | undefined) {
    if (!f) return;
    setName(f.name.replace(/\.[^.]+$/, ""));
    const url = URL.createObjectURL(f);
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = url;
  }

  function download() {
    const { dxf } = toDxf(loops, width);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([dxf], { type: "application/dxf" }));
    a.download = `${name}.dxf`;
    a.click();
  }

  const dims = loops.length ? toDxf(loops, width).heightMm : 0;
  const points = loops.reduce((s, l) => s + l.length, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="card flex flex-col gap-4 p-4">
        <input type="file" accept="image/*" onChange={(e) => load(e.target.files?.[0])} className="input" />
        <label className="text-sm">{th ? "ความกว้างจริง (มม.)" : "Real width (mm)"}
          <input type="number" min={1} value={width} onChange={(e) => setWidth(Number(e.target.value) || 1)} className="input mt-1" />
        </label>
        <label className="text-sm">{th ? "ความไวในการแยกพื้นหลัง" : "Background sensitivity"}: {threshold}
          <input type="range" min={5} max={120} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-full" />
        </label>
        <label className="text-sm">{th ? "ความเรียบของเส้น" : "Line smoothing"}: {detail}
          <input type="range" min={0.5} max={8} step={0.5} value={detail} onChange={(e) => setDetail(Number(e.target.value))} className="w-full" />
        </label>
        <label className="text-sm">{th ? "จำนวนระดับรายละเอียด" : "Detail levels"}: {levels}
          <input type="range" min={0} max={12} value={levels} onChange={(e) => setLevels(Number(e.target.value))} className="w-full" />
        </label>
        <label className="text-sm">{th ? "ตัดเส้นสั้นๆ ทิ้ง" : "Ignore small lines"}: {minLen}
          <input type="range" min={10} max={150} step={5} value={minLen} onChange={(e) => setMinLen(Number(e.target.value))} className="w-full" />
        </label>
        {loops.length > 0 && (
          <p className="text-sm text-muted">
            {th ? "ขนาดผลลัพธ์" : "Result size"}: {width} × {dims.toFixed(0)} mm · {loops.length} {th ? "เส้นขอบ" : "outlines"} · {points} {th ? "จุด" : "points"}
          </p>
        )}
        <button className="btn" disabled={!loops.length} onClick={download}>{th ? "ดาวน์โหลด DXF" : "Download DXF"}</button>
        <p className="text-xs text-muted">
          {th ? "ใช้รูปด้านหน้า พื้นหลังเรียบ ผลลัพธ์เป็นเส้นโดยประมาณ ควรตรวจและแก้ใน AutoCAD" : "Use a front view on a plain background. Lines are approximate; check and clean up in AutoCAD."}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-3">
          <p className="mb-2 text-sm font-semibold">{th ? "รูปต้นฉบับ" : "Original"}</p>
          <canvas ref={canvas} className="w-full rounded bg-white" />
        </div>
        <div className="card p-3">
          <p className="mb-2 text-sm font-semibold">{th ? "เส้นที่ได้" : "Traced lines"}</p>
          <svg viewBox={`0 0 ${size.w} ${size.h}`} className="w-full rounded bg-zinc-900">
            {loops.map((l, i) => (
              <polygon key={i} points={l.map((p) => p.join(",")).join(" ")} fill="none" stroke="#4ade80" strokeWidth={Math.max(size.w, size.h) / 400} />
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}
