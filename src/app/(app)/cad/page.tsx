import { getDictionary } from "@/lib/i18n";
import CadTracer from "@/components/CadTracer";

export default async function CadPage() {
  const { lang } = await getDictionary();
  const th = lang === "th";
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold">{th ? "แปลงรูปสินค้าเป็น CAD (DXF)" : "Product photo to CAD (DXF)"}</h1>
      <CadTracer th={th} />
    </section>
  );
}
