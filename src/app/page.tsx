import { redirect } from "next/navigation";
import { getActor } from "@/lib/security";
import { can, DomainError } from "@/lib/domain";
export const dynamic = "force-dynamic";
export default async function Home() {
  let destination = "/attendance";
  try {
    const actor = await getActor();
    destination = can(actor, "dashboard") ? "/home" : "/attendance";
  } catch (e) {
    if (e instanceof DomainError) redirect("/login");
    throw e;
  }
  redirect(destination);
}
