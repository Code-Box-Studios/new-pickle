import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { PasaloThread } from "@/components/pasalo/PasaloThread";

export const metadata: Metadata = { title: "Private Pasalo conversation", robots: { index: false, follow: false } };

export default async function PasaloTradePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!await getSession()) redirect(`/login?next=${encodeURIComponent(`/pasalo/trades/${id}`)}`);
  return <PasaloThread tradeId={id} />;
}
