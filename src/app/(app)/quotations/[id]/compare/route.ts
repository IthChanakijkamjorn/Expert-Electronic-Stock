import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/role";
import { FillError, fillCompareFile } from "@/lib/compareFill";
import type { QuoteLine } from "@/lib/quotation";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const role = await getRole();
  if (role !== "admin" && role !== "manager") return new Response("forbidden", { status: 403 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return new Response("กรุณาเลือกไฟล์ Excel", { status: 400 });
  let min = Number(form.get("min"));
  let max = Number(form.get("max"));
  if (!(min >= 0) || !(max >= 0) || max > 50) return new Response("ช่วง % ไม่ถูกต้อง", { status: 400 });
  if (min > max) [min, max] = [max, min];
  const supabase = await createClient();
  const { data: q } = await supabase.from("quotations").select("lines").eq("id", id).maybeSingle();
  if (!q) return new Response("not found", { status: 404 });
  try {
    const { buffer, warning } = await fillCompareFile(await file.arrayBuffer(), q.lines as QuoteLine[], min, max);
    const name = file.name.replace(/\.xlsx?$/i, "") + "-filled.xlsx";
    return new Response(new Uint8Array(buffer), {
      headers: {
        "X-Warning": encodeURIComponent(warning),
        "Access-Control-Expose-Headers": "X-Warning",
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="compare.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`,
      },
    });
  } catch (e) {
    if (e instanceof FillError) return new Response(e.message, { status: 400 });
    throw e;
  }
}
