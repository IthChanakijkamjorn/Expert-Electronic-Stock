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

export function dp(pts: Pt[], eps: number): Pt[] {
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

// Canny-style edges: Sobel gradient, thinning to 1px ridges, hysteresis, then chains of pixels as polylines.
export function traceEdges(gray: Float32Array, w: number, h: number, high: number, region: Uint8Array): Pt[][] {
  const low = high * 0.4;
  const mag = new Float32Array(w * h), dir = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const gx = gray[i - w + 1] + 2 * gray[i + 1] + gray[i + w + 1] - gray[i - w - 1] - 2 * gray[i - 1] - gray[i + w - 1];
    const gy = gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1] - gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1];
    mag[i] = Math.hypot(gx, gy) / 4;
    const a = (Math.atan2(gy, gx) * 180) / Math.PI;
    const aa = ((a % 180) + 180) % 180;
    dir[i] = aa < 22.5 || aa >= 157.5 ? 0 : aa < 67.5 ? 1 : aa < 112.5 ? 2 : 3;
  }
  const offs: [number, number][] = [[1, 0], [1, 1], [0, 1], [-1, 1]];
  const thin = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (mag[i] < low || !region[i]) continue;
    const [dx, dy] = offs[dir[i]];
    if (mag[i] >= mag[i + dy * w + dx] && mag[i] > mag[i - dy * w - dx]) thin[i] = mag[i] >= high ? 2 : 1;
  }
  // Hysteresis: keep weak ridge pixels only when connected to a strong one.
  const keep = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let i = 0; i < w * h; i++) if (thin[i] === 2) { keep[i] = 1; stack.push(i); }
  while (stack.length) {
    const i = stack.pop()!, x = i % w, y = (i / w) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const j = yy * w + xx;
      if (thin[j] && !keep[j]) { keep[j] = 1; stack.push(j); }
    }
  }
  const nbrs = (i: number) => {
    const x = i % w, y = (i / w) | 0, r: number[] = [];
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < w && yy < h && keep[yy * w + xx]) r.push(yy * w + xx);
    }
    return r;
  };
  const used = new Uint8Array(w * h);
  const chains: Pt[][] = [];
  const walk = (start: number) => {
    const chain: Pt[] = [];
    let cur = start;
    while (cur >= 0 && !used[cur]) {
      used[cur] = 1;
      chain.push([cur % w, (cur / w) | 0]);
      cur = nbrs(cur).find((n) => !used[n]) ?? -1;
    }
    if (chain.length > 1) chains.push(chain);
  };
  const all: number[] = [];
  for (let i = 0; i < w * h; i++) if (keep[i]) all.push(i);
  for (const i of all) if (!used[i] && nbrs(i).length === 1) walk(i);
  for (const i of all) if (!used[i]) walk(i);
  return chains;
}

// Fits loops to the real width (mm), flips Y for CAD and writes an R12 DXF that AutoCAD opens directly.
function fitCircle(pts: Pt[]) {
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sz = 0, sxz = 0, syz = 0;
  const n = pts.length;
  for (const [x, y] of pts) {
    const z = x * x + y * y;
    sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; sz += z; sxz += x * z; syz += y * z;
  }
  // Solve [sxx sxy sx; sxy syy sy; sx sy n] [A B C] = [sxz syz sz]
  const M = [[sxx, sxy, sx, sxz], [sxy, syy, sy, syz], [sx, sy, n, sz]];
  for (let i = 0; i < 3; i++) {
    let piv = i;
    for (let r = i + 1; r < 3; r++) if (Math.abs(M[r][i]) > Math.abs(M[piv][i])) piv = r;
    [M[i], M[piv]] = [M[piv], M[i]];
    if (Math.abs(M[i][i]) < 1e-9) return null;
    for (let r = 0; r < 3; r++) if (r !== i) { const f = M[r][i] / M[i][i]; for (let c = i; c < 4; c++) M[r][c] -= f * M[i][c]; }
  }
  const A = M[0][3] / M[0][0], B = M[1][3] / M[1][1], C = M[2][3] / M[2][2];
  const cx = A / 2, cy = B / 2, r2 = C + cx * cx + cy * cy;
  if (r2 <= 0) return null;
  const r = Math.sqrt(r2);
  let err = 0;
  for (const [x, y] of pts) err += (Math.hypot(x - cx, y - cy) - r) ** 2;
  return { cx, cy, r, rms: Math.sqrt(err / n) };
}

// Replaces a traced chain with a true circle/arc when it fits one, otherwise straightens near-horizontal/vertical runs.
export function cleanChain(chain: Pt[], eps: number): Pt[] {
  if (chain.length >= 12) {
    const f = fitCircle(chain);
    if (f && f.r > 6 && f.rms / f.r < 0.035) {
      const ang = chain.map(([x, y]) => Math.atan2(y - f.cy, x - f.cx)).sort((a, b) => a - b);
      let gap = ang[0] + 2 * Math.PI - ang[ang.length - 1], gi = 0;
      for (let i = 1; i < ang.length; i++) if (ang[i] - ang[i - 1] > gap) { gap = ang[i] - ang[i - 1]; gi = i; }
      const span = 2 * Math.PI - gap;
      if (span > 0.9) {
        const full = gap < 0.35;
        const start = full ? 0 : ang[gi];
        const total = full ? 2 * Math.PI : span;
        const steps = Math.max(8, Math.ceil((total / (2 * Math.PI)) * 96));
        const out: Pt[] = [];
        for (let i = 0; i <= steps; i++) {
          if (full && i === steps) break;
          const a = start + (total * i) / steps;
          out.push([f.cx + f.r * Math.cos(a), f.cy + f.r * Math.sin(a)]);
        }
        return out;
      }
    }
  }
  const pts = dp(chain, eps).map((p) => [...p] as Pt);
  const tol = Math.tan((4 * Math.PI) / 180);
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = Math.abs(pts[i + 1][0] - pts[i][0]), dy = Math.abs(pts[i + 1][1] - pts[i][1]);
    if (dx + dy < 6) continue;
    if (dy < dx * tol) { const m = (pts[i][1] + pts[i + 1][1]) / 2; pts[i][1] = m; pts[i + 1][1] = m; }
    else if (dx < dy * tol) { const m = (pts[i][0] + pts[i + 1][0]) / 2; pts[i][0] = m; pts[i + 1][0] = m; }
  }
  return pts;
}

const closed = (l: Pt[]) => l.length > 2 && Math.hypot(l[0][0] - l[l.length - 1][0], l[0][1] - l[l.length - 1][1]) < 1.5;

export function toDxf(loops: Pt[][], widthMm: number): { dxf: string; heightMm: number } {
  const xs = loops.flat().map((p) => p[0]), ys = loops.flat().map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const k = widthMm / (maxX - minX || 1);
  const out = ["0", "SECTION", "2", "HEADER", "9", "$ACADVER", "1", "AC1009", "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES"];
  for (const l of loops) {
    out.push("0", "POLYLINE", "8", "TRACE", "66", "1", "70", String(closed(l) ? 1 : 0));
    for (const [x, y] of l) out.push("0", "VERTEX", "8", "TRACE", "10", ((x - minX) * k).toFixed(3), "20", ((maxY - y) * k).toFixed(3), "30", "0");
    out.push("0", "SEQEND", "8", "TRACE");
  }
  out.push("0", "ENDSEC", "0", "EOF");
  return { dxf: out.join("\r\n"), heightMm: (maxY - minY) * k };
}
