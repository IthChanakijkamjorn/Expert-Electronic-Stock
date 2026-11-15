import { redirect } from "next/navigation";
import { getRole } from "@/lib/role";
import { PlanLoader } from "../PlanLoader";

export default async function NewPlanPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const role = await getRole();
  if (role !== "admin" && role !== "manager") redirect("/floorplans");
  const { project } = await searchParams;
  return <PlanLoader plan={null} projectId={project ?? ""} />;
}
