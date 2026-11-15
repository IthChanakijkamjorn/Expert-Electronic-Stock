import { QuotationEditor } from "../../QuotationEditor";

export default async function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuotationEditor id={id} />;
}
