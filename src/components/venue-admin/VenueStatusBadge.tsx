import { Badge } from "@/components/ui/badge";
import type { VenueStatus } from "@/generated/prisma";

const MAP: Record<VenueStatus, { label: string; tone: "neutral" | "brand" | "amber" | "red" }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  PENDING_REVIEW: { label: "Under review", tone: "amber" },
  APPROVED: { label: "Approved", tone: "brand" },
  REJECTED: { label: "Changes requested", tone: "red" },
  SUSPENDED: { label: "Suspended", tone: "red" },
};

export function VenueStatusBadge({ status }: { status: VenueStatus }) {
  const m = MAP[status];
  return (
    <Badge tone={m.tone} dot>
      {m.label}
    </Badge>
  );
}
