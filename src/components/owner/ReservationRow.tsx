import Link from "next/link";
import { BookingStatusBadge } from "@/components/ui/badge";
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
    <li className="rounded-2xl border border-black/5 bg-white p-4">
      <Link href={`/owner/reservations/${b.reference}`} className="block">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">
              {b.customerName ?? "Guest"}
            </p>
            <p className="text-sm text-muted">
              {b.venueName} · {b.courtName}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              {dateLabel(b.startsAt)} · {timeLabel(b.startsAt)} – {timeLabel(b.endsAt)} ·{" "}
              {pesos(b.priceCents)}
            </p>
          </div>
          <BookingStatusBadge status={b.status} />
        </div>
      </Link>
    </li>
  );
}
