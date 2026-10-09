import { JobWorkspace } from "@/components/job-workspace";
import { getActor } from "@/lib/security";
import { jobDetail } from "@/modules/queries";
import { DomainError } from "@/lib/domain";
import { notFound } from "next/navigation";
export default async function JobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await getActor();
  const { id } = await params;
  try {
    await jobDetail(actor, id);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  return <JobWorkspace id={id} actor={actor} />;
}
