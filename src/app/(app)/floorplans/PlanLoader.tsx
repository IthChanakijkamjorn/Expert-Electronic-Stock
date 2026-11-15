import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n";
import { fetchAll } from "@/lib/fetchAll";
import { signedUrls } from "@/lib/storage";
import type { PlanData } from "@/lib/floorplan";
import { PlanEditor } from "./PlanEditor";

export async function PlanLoader({
  plan,
  projectId,
}: {
  plan: { id: string; name: string; width_m: number; height_m: number; project_id: string | null; data: PlanData } | null;
  projectId: string;
}) {
  const { t } = await getDictionary();
  const supabase = await createClient();
  const [products, { data: projects }] = await Promise.all([
    fetchAll((a, b) =>
      supabase.from("products").select("id, name, sku, brand, unit, image_path").eq("active", true).order("id").range(a, b),
    ),
    supabase.from("projects").select("id, name, year, towers(name, organizations(name))").order("year", { ascending: false }).limit(500),
  ]);
  const urls = await signedUrls(products.map((p) => p.image_path));
  const imageUrls: Record<string, string> = {};
  products.forEach((p) => {
    const u = p.image_path && urls.get(p.image_path);
    if (u) imageUrls[p.id] = u;
  });
  const projectOptions = (projects ?? []).map((p) => {
    const tw = p.towers as unknown as { name: string; organizations: { name: string } };
    return { id: p.id, label: `${tw.organizations.name} › ${tw.name} › ${p.year} › ${p.name}` };
  });

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold">{plan ? plan.name : t.fpNew}</h1>
      <PlanEditor
        t={t}
        id={plan?.id ?? null}
        products={products.map((p) => ({ id: p.id, name: p.name, sku: p.sku, brand: p.brand, unit: p.unit }))}
        imageUrls={imageUrls}
        projects={projectOptions}
        initial={{
          name: plan?.name ?? "",
          width: Number(plan?.width_m ?? 6),
          height: Number(plan?.height_m ?? 4),
          projectId: plan?.project_id ?? projectId,
          data: plan?.data ?? { walls: [], used: [], items: [] },
        }}
      />
    </section>
  );
}
