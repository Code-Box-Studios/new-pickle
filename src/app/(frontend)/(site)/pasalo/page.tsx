import type { Metadata } from "next";
import { PasaloDiscovery } from "@/components/pasalo/PasaloDiscovery";

export const metadata: Metadata = { title: "Pasalo — discounted court bookings" };

export default function PasaloPage() {
  return <PasaloDiscovery />;
}
