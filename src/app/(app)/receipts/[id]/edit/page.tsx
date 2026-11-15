import { ReceiptEditor } from "../../ReceiptEditor";

export default async function EditReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReceiptEditor id={id} />;
}
