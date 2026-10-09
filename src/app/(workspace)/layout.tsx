import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { getActor } from "@/lib/security";
import { DomainError } from "@/lib/domain";
export const dynamic = "force-dynamic";
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let actor;
  try {
    actor = await getActor();
  } catch (e) {
    if (e instanceof DomainError) redirect("/login");
    throw e;
  }
  return <Shell actor={actor}>{children}</Shell>;
}
