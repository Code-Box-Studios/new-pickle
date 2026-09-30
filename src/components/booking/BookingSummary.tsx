import { Card } from "@/components/ui/card";
import { longDateLabel, pesos, timeLabel } from "@/lib/format";

export function BookingSummary({
  venueName,
  courtName,
  startsAt,
  endsAt,
  priceCents,
}: {
  venueName: string;
  courtName: string;
  startsAt: Date;
  endsAt: Date;
  priceCents: number;
}) {
  return (
    <Card className="p-6 sm:p-7">
      <p className="break-words text-xl font-semibold tracking-tight text-ink">{venueName}</p>
      <p className="mt-1 break-words text-sm leading-6 text-muted">{courtName}</p>
      <dl className="mt-6 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 sm:gap-6">
        <div className="min-w-0">
          <dt className="text-muted">Date</dt>
          <dd className="mt-1 break-words font-medium leading-6 text-ink">{longDateLabel(startsAt)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-muted">Time</dt>
          <dd className="mt-1 font-medium leading-6 text-ink">
            {timeLabel(startsAt)} – {timeLabel(endsAt)}
          </dd>
        </div>
      </dl>
      <p className="mt-6 border-t border-line pt-5 text-2xl font-semibold tracking-tight text-ink">{pesos(priceCents)}</p>
    </Card>
  );
}
