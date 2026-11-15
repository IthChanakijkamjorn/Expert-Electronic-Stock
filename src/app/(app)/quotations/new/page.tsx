import { QuotationEditor } from "../QuotationEditor";

export default async function NewQuotationPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project } = await searchParams;
  return <QuotationEditor project={project} />;
}
