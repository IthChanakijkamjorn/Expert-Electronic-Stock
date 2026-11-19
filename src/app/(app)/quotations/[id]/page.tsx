import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";
import { signedUrls } from "@/lib/storage";
import { mergeDocCompany } from "@/lib/company";
import CompareFill from "@/components/CompareFill";
import { QuotationPaper } from "@/components/QuotationPaper";
import type { QuoteLine } from "@/lib/quotation";

export default async function QuotationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const role = await getRole();
  if (role !== "admin" && role !== "manager") redirect("/documents");
  const { id } = await params;
  const { created } = await searchParams;
  const { t } = await getDictionary();
  const supabase = await createClient();
  const { data: q } = await supabase.from("quotations").select("*, projects(name)").eq("id", id).maybeSingle();
  if (!q) notFound();
  const { data: sig } = q.signature_id
    ? await supabase.from("signatures").select("path").eq("id", q.signature_id).maybeSingle()
    : { data: null };
  const urls = await signedUrls([sig?.path]);

  return (
    <section className="flex flex-col gap-4">
      <div className="card flex flex-wrap items-center gap-3 print:hidden">
        <h1 className="text-2xl font-semibold">{q.number ?? t.draftLabel}</h1>
        {q.status === "draft" && <span className="pill">{t.draftLabel}</span>}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Link href="/quotations" className="btn-ghost">← {t.quotation}</Link>
          <Link href={`/quotations/${id}/edit`} className="btn-ghost">✎ {t.docEdit}</Link>
          <a href={`/quotations/${id}/pdf?download=1`} className="btn">⬇ PDF</a>
          <a href={`/quotations/${id}/xlsx`} className="btn">⬇ Excel</a>
        </div>
        {created && <p className="w-full rounded-lg bg-emerald-50 px-3 py-2 text-emerald-700">{q.status === "draft" ? t.draftSaved : t.docSaved}</p>}
      </div>
      <div className="overflow-x-auto pb-4">
        <QuotationPaper
          data={{
            number: q.number ?? "DRAFT",
            company: mergeDocCompany(q.company, "quote"),
            customer: q.customer,
            attention: q.attention ?? "",
            project: q.project_label ?? (q.projects as unknown as { name: string } | null)?.name ?? "",
            phone: q.phone ?? "",
            email: q.email ?? "",
            date: q.quote_date,
            validDays: q.valid_days === null ? "" : String(q.valid_days),
            leadDays: q.lead_days === null ? "" : String(q.lead_days),
            warrantyYears: q.warranty_years === null ? "" : String(Number(q.warranty_years)),
            quotedBy: q.quoted_by ?? "",
            paymentTerms: q.payment_terms ?? "",
            discountPct: String(Number(q.discount_pct)),
            vat: q.vat,
            signatureUrl: sig?.path ? (urls.get(sig.path) ?? null) : null,
            lines: (q.lines as QuoteLine[]).map((l, i) => ({
              key: String(i), brand: l.brand, model: l.model, name: l.name, unit: l.unit, qty: String(l.qty), price: String(l.price),
            })),
          }}
        />
      </div>
      {q.status !== "draft" && <CompareFill id={id} />}
    </section>
  );
}
