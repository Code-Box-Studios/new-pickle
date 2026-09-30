import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BookingStatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { dateLabel, pesos, timeLabel } from "@/lib/format";
import type { BookingStatus } from "@/generated/prisma";

export interface ReservationRowData {
  reference: string;
  status: BookingStatus;
  startsAt: Date;
  endsAt: Date;
  priceCents: number;
  customerName: string | null;
  venueName: string;
  courtName: string;
}

export function ReservationRow({ b }: { b: ReservationRowData }) {
  return (
    <li>
      <Card className="overflow-hidden p-0 transition-colors hover:border-brand-300">
        <Link href={`/owner/reservations/${b.reference}`} className="motion-trigger block rounded-[var(--radius-card)] p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 flex-1 basis-48">
              <p className="truncate font-semibold text-ink">
                {b.customerName ?? "Guest"}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {b.venueName} · {b.courtName}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                {dateLabel(b.startsAt)} · {timeLabel(b.startsAt)} – {timeLabel(b.endsAt)} ·{" "}
                {pesos(b.priceCents)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3"><BookingStatusBadge status={b.status} /><ChevronRight className="motion-arrow size-4 text-muted" data-direction="right" aria-hidden /></div>
          </div>
        </Link>
      </Card>
    </li>
  );
}
