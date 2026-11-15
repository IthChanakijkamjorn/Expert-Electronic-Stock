import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/role";
import { buildQuotation, type QuoteLine } from "@/lib/quotation";
import { parseVariant } from "@/lib/docType";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const role = await getRole();
  if (role !== "admin" && role !== "manager") return new Response("forbidden", { status: 403 });

  const supabase = await createClient();
  const { data: q } = await supabase.from("quotations").select("*, projects(name)").eq("id", id).maybeSingle();
  if (!q) return new Response("not found", { status: 404 });

  const { data: sig } = q.signature_id
    ? await supabase.from("signatures").select("path").eq("id", q.signature_id).maybeSingle()
    : { data: null };
  const sigFile = sig?.path ? (await supabase.storage.from("files").download(sig.path)).data : null;
  const signature = sigFile ? new Uint8Array(await sigFile.arrayBuffer()) : null;

  const pdf = await buildQuotation({
    signature,
    variant: parseVariant(new URL(req.url).searchParams.get("doc")),
    number: q.number,
    date: new Date(q.quote_date),
    customer: q.customer,
    attention: q.attention,
    project: q.project_label ?? (q.projects as unknown as { name: string } | null)?.name ?? "",
    phone: q.phone,
    email: q.email,
    validDays: q.valid_days,
    leadDays: q.lead_days,
    warrantyYears: q.warranty_years === null ? null : Number(q.warranty_years),
    paymentTerms: q.payment_terms,
    discountPct: Number(q.discount_pct),
    vat: q.vat,
    quotedBy: q.quoted_by,
    company: q.company,
    lines: q.lines as QuoteLine[],
  });
  return new Response(Buffer.from(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${q.number}.pdf"` },
  });
}
