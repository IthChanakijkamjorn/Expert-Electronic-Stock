import { getDictionary } from "@/lib/i18n";
import { getRole } from "@/lib/role";
import { ProductForm } from "./ProductForm";

export default async function NewProductPage() {
  const { t } = await getDictionary();
  const role = await getRole();
  if (role !== "admin" && role !== "manager") return <p>{t.noPermission}</p>;
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t.addProduct}</h1>
      <ProductForm t={t} />
    </section>
  );
}
