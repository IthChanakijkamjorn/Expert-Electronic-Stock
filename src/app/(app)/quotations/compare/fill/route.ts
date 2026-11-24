import { getRole } from "@/lib/role";
import { FillError, fillCompareFile } from "@/lib/compareFill";
import type { QuoteLine } from "@/lib/quotation";

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_LINES = 500;

function parseLines(raw: unknown): QuoteLine[] | null {
  if (typeof raw !== "string") return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(data) || data.length > MAX_LINES) return null;
  const str = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 2000) : "");
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0);
  return data
    .map((l: Record<string, unknown>) => ({ brand: str(l?.brand), model: str(l?.model), name: str(l?.name), unit: str(l?.unit), qty: n(l?.qty), price: n(l?.price) }))
    .filter((l) => l.name || l.model || l.brand);
}

export async function POST(req: Request) {
  const role = await getRole();
  if (role !== "admin" && role !== "manager") return new Response("forbidden", { status: 403 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return new Response("กรุณาเลือกไฟล์ Excel ของบริษัท", { status: 400 });
  if (file.size > MAX_BYTES) return new Response("ไฟล์ใหญ่เกิน 15MB", { status: 400 });
  const lines = parseLines(form.get("lines"));
  if (!lines?.length) return new Response(`ไม่มีรายการสินค้า (สูงสุด ${MAX_LINES} รายการ)`, { status: 400 });
  let min = Number(form.get("min"));
  let max = Number(form.get("max"));
  if (!(min >= 0) || !(max >= 0) || max > 50 || min > 50) return new Response("ช่วง % ไม่ถูกต้อง (0–50)", { status: 400 });
  if (min > max) [min, max] = [max, min];
  try {
    const rawDate = String(form.get("date") ?? "");
    const meta = {
      date: /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : "",
      project: String(form.get("project") ?? "").trim().slice(0, 500),
    };
    const { buffer } = await fillCompareFile(await file.arrayBuffer(), lines, min, max, meta);
    const name = file.name.replace(/\.xlsx?$/i, "") + "-filled.xlsx";
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="compare.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`,
      },
    });
  } catch (e) {
    if (e instanceof FillError) return new Response(e.message, { status: 400 });
    console.error("compare fill failed", e);
    return new Response("สร้างไฟล์ไม่สำเร็จ ไฟล์อาจเสียหรือไม่ใช่ .xlsx", { status: 400 });
  }
}
