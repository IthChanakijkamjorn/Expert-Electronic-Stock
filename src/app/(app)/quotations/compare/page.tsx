import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";
import CompareFill from "@/components/CompareFill";
import type { QuoteLine } from "@/lib/quotation";

export default async function ComparePage() {
  const role = await getRole();
  if (role !== "admin" && role !== "manager") redirect("/documents");
  const { t } = await getDictionary();
  const supabase = await createClient();
  const { data } = await supabase
    .from("quotations").select("id, number, customer, project_label, quote_date, lines, projects(name)").eq("status", "final").order("number", { ascending: false }).limit(200);
  const sources = (data ?? []).map((q) => {
    const project = q.project_label ?? (q.projects as unknown as { name: string } | null)?.name ?? "";
    return {
      id: q.id as string,
      label: [q.number, q.customer, project].filter(Boolean).join(" · "),
      lines: (q.lines ?? []) as QuoteLine[],
      meta: { date: String(q.quote_date ?? "").slice(0, 10), project },
    };
  });
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">คู่เทียบ</h1>
        <Link href="/quotations" className="btn-ghost">← {t.quotation}</Link>
      </div>
      <CompareFill sources={sources} />
    </section>
  );
}
