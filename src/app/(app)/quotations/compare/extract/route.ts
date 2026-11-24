import { getRole } from "@/lib/role";
import { ExtractError, extractLines } from "@/lib/compareExtract";

const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(req: Request) {
  const role = await getRole();
  if (role !== "admin" && role !== "manager") return new Response("forbidden", { status: 403 });
  const file = (await req.formData()).get("file");
  if (!(file instanceof File) || !file.size) return new Response("กรุณาเลือกไฟล์", { status: 400 });
  if (file.size > MAX_BYTES) return new Response("ไฟล์ใหญ่เกิน 15MB", { status: 400 });
  try {
    return Response.json(await extractLines(await file.arrayBuffer(), file.name));
  } catch (e) {
    if (e instanceof ExtractError) return new Response(e.message, { status: 400 });
    console.error("compare extract failed", e);
    return new Response("อ่านไฟล์ไม่สำเร็จ ไฟล์อาจเสียหรือมีรูปแบบที่ไม่รองรับ", { status: 400 });
  }
}
