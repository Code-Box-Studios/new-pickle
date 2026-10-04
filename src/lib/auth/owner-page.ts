import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSignInSession } from "./session";
import { ownerDestination, ownerVerificationPath, requiresOwnerMfa } from "./owner-security";

/** Workspace pages redirect before loading private venue data. APIs use getSession(). */
export async function getOwnerPageSession() {
  const path = ownerDestination((await headers()).get("x-pikol-path"));
  const session = await getSignInSession();
  if (!session) redirect(`/owner/login?next=${encodeURIComponent(path)}`);
  if (!requiresOwnerMfa(session.role)) redirect("/list-your-venue");
  if (!session.mfaVerified) redirect(ownerVerificationPath(ownerDestination(path, session.role)));
  return session;
}
