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
    <Card className="p-4">
      <p className="font-semibold text-ink">{venueName}</p>
      <p className="text-sm text-muted">{courtName}</p>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted">Date</dt>
          <dd className="font-medium text-ink">{longDateLabel(startsAt)}</dd>
        </div>
        <div>
          <dt className="text-muted">Time</dt>
          <dd className="font-medium text-ink">
            {timeLabel(startsAt)} – {timeLabel(endsAt)}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-lg font-bold text-ink">{pesos(priceCents)}</p>
    </Card>
  );
}
