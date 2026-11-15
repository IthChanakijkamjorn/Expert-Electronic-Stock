import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/role";
import { getDictionary } from "@/lib/i18n";
import type { PlanData } from "@/lib/floorplan";
import { PlanLoader } from "../PlanLoader";
import { deletePlan } from "../actions";

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await getDictionary();
  const supabase = await createClient();
  const { data: plan } = await supabase.from("floor_plans").select("*").eq("id", id).maybeSingle();
  if (!plan) notFound();
  const role = await getRole();
  const manager = role === "admin" || role === "manager";
  return (
    <>
      <PlanLoader plan={{ ...plan, data: plan.data as PlanData }} projectId="" />
      {manager && (
        <form action={deletePlan.bind(null, id)} className="mt-6">
          <button className="btn-ghost text-red-600">🗑 {t.fpDelete}</button>
        </form>
      )}
    </>
  );
}
