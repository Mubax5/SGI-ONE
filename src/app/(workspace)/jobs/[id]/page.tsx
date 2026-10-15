import { JobWorkspace } from "@/components/job-workspace";
import { getActor } from "@/lib/security";
import { jobDetail } from "@/modules/queries";
import { DomainError } from "@/lib/domain";
import { notFound } from "next/navigation";
import {
  scopedWorkspaceActor,
  redirectLegacyWorkspace,
} from "@/lib/workspace-server";
import type { PageQuery } from "@/lib/workspace-url";
import { z } from "zod";
export default async function JobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<PageQuery>;
}) {
  const { id } = await params;
  redirectLegacyWorkspace(`/jobs/${id}`, await searchParams);
  if (!z.uuid().safeParse(id).success) notFound();
  const actor = await scopedWorkspaceActor(await getActor());
  try {
    await jobDetail(actor, id);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  return <JobWorkspace key={`${id}:${actor.roles[0]}`} id={id} actor={actor} />;
}
