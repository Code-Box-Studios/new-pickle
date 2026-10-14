import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { PasaloDetail } from "@/components/pasalo/PasaloDetail";

export const metadata: Metadata = { title: "Pasalo booking offer" };

export default async function PasaloDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, getSession()]);
  return <PasaloDetail listingId={id} isAuthed={!!session} customerMobile={session?.mobile ?? ""} />;
}
