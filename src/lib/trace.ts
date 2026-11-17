export type Pt = [number, number];

// Outlines the dark/different-from-background shape with marching squares, returning closed loops in pixel units.
export function traceMask(mask: Uint8Array, w: number, h: number): Pt[][] {
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : mask[y * w + x]);
  const adj = new Map<string, string[]>();
  const link = (a: string, b: string) => {
    (adj.get(a) ?? adj.set(a, []).get(a)!).push(b);
    (adj.get(b) ?? adj.set(b, []).get(b)!).push(a);
  };
  const key = (x: number, y: number) => `${x},${y}`;
  for (let y = -1; y < h; y++) {
    for (let x = -1; x < w; x++) {
      const c = at(x, y) | (at(x + 1, y) << 1) | (at(x + 1, y + 1) << 2) | (at(x, y + 1) << 3);
      const T = key(2 * x + 1, 2 * y), R = key(2 * x + 2, 2 * y + 1), B = key(2 * x + 1, 2 * y + 2), L = key(2 * x, 2 * y + 1);
      const segs: Record<number, [string, string][]> = {
        1: [[L, T]], 2: [[T, R]], 3: [[L, R]], 4: [[R, B]], 5: [[L, T], [R, B]], 6: [[T, B]], 7: [[L, B]],
        8: [[B, L]], 9: [[T, B]], 10: [[T, R], [B, L]], 11: [[R, B]], 12: [[L, R]], 13: [[T, R]], 14: [[L, T]],
      };
      (segs[c] ?? []).forEach(([a, b]) => link(a, b));
    }
  }
  const seen = new Set<string>();
  const loops: Pt[][] = [];
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const loop: Pt[] = [];
    let prev = "", cur = start;
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      const [x, y] = cur.split(",").map(Number);
      loop.push([x / 2, y / 2]);
      const next = adj.get(cur)!.find((n) => n !== prev && !seen.has(n));
      prev = cur;
      cur = next ?? "";
    }
    loops.push(loop);
  }
  return loops;
}

function dp(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts;
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
  let m = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs(dy * (pts[i][0] - ax) - dx * (pts[i][1] - ay)) / len;
    if (d > m) { m = d; idx = i; }
  }
  if (m <= eps) return [pts[0], pts[pts.length - 1]];
  return [...dp(pts.slice(0, idx + 1), eps).slice(0, -1), ...dp(pts.slice(idx), eps)];
}

export function simplifyLoop(loop: Pt[], eps: number): Pt[] {
  if (loop.length < 4) return loop;
  const half = Math.floor(loop.length / 2);
  const a = dp(loop.slice(0, half + 1), eps);
  const b = dp([...loop.slice(half), loop[0]], eps);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}

// Fits loops to the real width (mm), flips Y for CAD and writes an R12 DXF that AutoCAD opens directly.
export function toDxf(loops: Pt[][], widthMm: number): { dxf: string; heightMm: number } {
  const xs = loops.flat().map((p) => p[0]), ys = loops.flat().map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const k = widthMm / (maxX - minX || 1);
  const out = ["0", "SECTION", "2", "HEADER", "9", "$ACADVER", "1", "AC1009", "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES"];
  for (const l of loops) {
    out.push("0", "POLYLINE", "8", "TRACE", "66", "1", "70", "1");
    for (const [x, y] of l) out.push("0", "VERTEX", "8", "TRACE", "10", ((x - minX) * k).toFixed(3), "20", ((maxY - y) * k).toFixed(3), "30", "0");
    out.push("0", "SEQEND", "8", "TRACE");
  }
  out.push("0", "ENDSEC", "0", "EOF");
  return { dxf: out.join("\r\n"), heightMm: (maxY - minY) * k };
}
