import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/role";
import { buildQuotation, type QuoteLine } from "@/lib/quotation";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string; id: string }> },
) {
  const { projectId, id } = await params;
  const role = await getRole();
  if (role !== "admin" && role !== "manager") return new Response("forbidden", { status: 403 });

  const supabase = await createClient();
  const { data: q } = await supabase
    .from("quotations")
    .select("*, projects(name)")
    .eq("id", id)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!q) return new Response("not found", { status: 404 });

  const { data: setting } = await supabase.from("company_settings").select("value").eq("key", "signature").maybeSingle();
  const sigFile = setting?.value ? (await supabase.storage.from("files").download(setting.value)).data : null;
  const signature = sigFile ? new Uint8Array(await sigFile.arrayBuffer()) : null;

  const pdf = await buildQuotation({
    signature,
    number: q.number,
    date: new Date(q.created_at),
    customer: q.customer,
    attention: q.attention,
    project: (q.projects as unknown as { name: string }).name,
    phone: q.phone,
    email: q.email,
    validDays: q.valid_days,
    leadDays: q.lead_days,
    warrantyYears: q.warranty_years === null ? null : Number(q.warranty_years),
    paymentTerms: q.payment_terms,
    discountPct: Number(q.discount_pct),
    vat: q.vat,
    quotedBy: q.quoted_by,
    lines: q.lines as QuoteLine[],
  });
  return new Response(Buffer.from(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${q.number}.pdf"` },
  });
}
