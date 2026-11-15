import { PDFDocument, rgb, type PDFImage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@/lib/supabase/server";
import type { PlanData } from "@/lib/floorplan";
import { fit } from "@/lib/quotation";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: plan } = await supabase.from("floor_plans").select("*, projects(name)").eq("id", id).maybeSingle();
  if (!plan) return new Response("not found", { status: 404 });
  const data = plan.data as PlanData;
  const { data: products } = data.used.length
    ? await supabase.from("products").select("id, name, sku, brand, image_path").in("id", data.used)
    : { data: [] };

  const [regularBytes, boldBytes] = await Promise.all([
    readFile(path.join(process.cwd(), "fonts", "Sarabun-Regular.ttf")),
    readFile(path.join(process.cwd(), "fonts", "Sarabun-Bold.ttf")),
  ]);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(regularBytes, { subset: true });
  const bold = await doc.embedFont(boldBytes, { subset: true });

  // Thumbnails: only PNG/JPEG can be embedded; anything else is skipped.
  const thumbs = new Map<string, PDFImage>();
  await Promise.all(
    (products ?? []).map(async (p) => {
      if (!p.image_path) return;
      try {
        const file = (await supabase.storage.from("files").download(p.image_path)).data;
        if (!file) return;
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (bytes[0] === 0x89) thumbs.set(p.id, await doc.embedPng(bytes));
        else if (bytes[0] === 0xff) thumbs.set(p.id, await doc.embedJpg(bytes));
      } catch {
        // skip unreadable images
      }
    }),
  );

  const W = 842;
  const H = 595;
  const M = 28;
  const LEG = 250;
  const black = rgb(0, 0, 0);
  const page = doc.addPage([W, H]);
  const width = Number(plan.width_m);
  const height = Number(plan.height_m);

  page.drawText(plan.name, { x: M, y: H - M - 14, size: 16, font: bold, color: black });
  const sub = [(plan.projects as unknown as { name: string } | null)?.name, `${width} × ${height} m`].filter(Boolean).join("  ·  ");
  page.drawText(sub, { x: M, y: H - M - 30, size: 10, font, color: rgb(0.35, 0.35, 0.4) });

  const areaX = M;
  const areaY = M + 14;
  const areaW = W - 3 * M - LEG;
  const areaH = H - 2 * M - 50;
  const scale = Math.min(areaW / width, areaH / height);
  const ox = areaX + (areaW - width * scale) / 2;
  const oy = areaY + (areaH - height * scale) / 2;
  const X = (x: number) => ox + x * scale;
  const Y = (y: number) => oy + (height - y) * scale; // plan y grows downwards

  for (let x = 0; x <= width; x += 1)
    page.drawLine({ start: { x: X(x), y: Y(0) }, end: { x: X(x), y: Y(height) }, thickness: 0.3, color: rgb(0.88, 0.88, 0.9) });
  for (let y = 0; y <= height; y += 1)
    page.drawLine({ start: { x: X(0), y: Y(y) }, end: { x: X(width), y: Y(y) }, thickness: 0.3, color: rgb(0.88, 0.88, 0.9) });
  page.drawRectangle({ x: X(0), y: Y(height), width: width * scale, height: height * scale, borderWidth: 2.5, borderColor: black });
  data.walls.forEach((w) =>
    page.drawLine({ start: { x: X(w.x1), y: Y(w.y1) }, end: { x: X(w.x2), y: Y(w.y2) }, thickness: 2.5, color: black }),
  );

  const num = new Map(data.used.map((u, i) => [u, i + 1]));
  const rad = Math.max(7, Math.min(14, (Math.max(width, height) / 40) * scale));
  data.items.forEach((i) => {
    const cx = X(i.x);
    const cy = Y(i.y);
    page.drawCircle({ x: cx, y: cy, size: rad, color: rgb(0.12, 0.23, 0.54), borderColor: black, borderWidth: 0.8 });
    const label = String(num.get(i.product_id) ?? "?");
    const sz = rad * 1.05;
    page.drawText(label, { x: cx - bold.widthOfTextAtSize(label, sz) / 2, y: cy - sz * 0.33, size: sz, font: bold, color: rgb(1, 1, 1) });
  });

  // Legend: numbered products with thumbnail, name and count; continues on extra pages.
  const counts = new Map<string, number>();
  data.items.forEach((i) => counts.set(i.product_id, (counts.get(i.product_id) ?? 0) + 1));
  const byId = new Map((products ?? []).map((p) => [p.id, p]));
  const lx = W - M - LEG;
  const ROW = 44;
  let pg = page;
  let y = H - M - 14;
  pg.drawText("สินค้าที่ใช้ / Products", { x: lx, y, size: 11, font: bold, color: black });
  y -= 12;
  data.used.forEach((pid, idx) => {
    const p = byId.get(pid);
    if (!p) return;
    if (y - ROW < M) {
      pg = doc.addPage([W, H]);
      y = H - M;
    }
    const top = y;
    pg.drawCircle({ x: lx + 9, y: top - 22, size: 9, color: rgb(0.12, 0.23, 0.54) });
    const l = String(idx + 1);
    pg.drawText(l, { x: lx + 9 - bold.widthOfTextAtSize(l, 9) / 2, y: top - 25, size: 9, font: bold, color: rgb(1, 1, 1) });
    const img = thumbs.get(pid);
    if (img) {
      const s = Math.min(36 / img.width, 36 / img.height);
      pg.drawImage(img, { x: lx + 24, y: top - 40, width: img.width * s, height: img.height * s });
    } else {
      pg.drawRectangle({ x: lx + 24, y: top - 40, width: 36, height: 36, borderWidth: 0.5, borderColor: rgb(0.7, 0.7, 0.75) });
    }
    const tx = lx + 68;
    const tw = LEG - 68;
    pg.drawText(fit(p.name, bold, 9, tw), { x: tx, y: top - 15, size: 9, font: bold, color: black });
    pg.drawText(fit([p.brand, p.sku].filter(Boolean).join(" · "), font, 8, tw), { x: tx, y: top - 27, size: 8, font, color: rgb(0.35, 0.35, 0.4) });
    pg.drawText(`x ${counts.get(pid) ?? 0}`, { x: tx, y: top - 39, size: 9, font: bold, color: black });
    y -= ROW;
  });

  const pdf = await doc.save();
  return new Response(Buffer.from(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="floorplan-${id}.pdf"` },
  });
}
