import { timeLabel, dateLabel } from "@/lib/format";

function humanize(status: string): string {
  const s = status.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function StatusTimeline({
  history,
}: {
  history: { toStatus: string; at: Date; note: string | null }[];
}) {
  return (
    <ol className="space-y-4">
      {history.map((h, i) => (
        <li key={i} className="flex gap-4">
          <div className="flex shrink-0 flex-col items-center">
            <span className="mt-1.5 size-2 rounded-full bg-brand-700" aria-hidden />
            {i < history.length - 1 && <span className="mt-2 w-px flex-1 bg-line" aria-hidden />}
          </div>
          <div className="min-w-0 pb-1">
            <p className="text-sm font-medium leading-6 text-ink">{humanize(h.toStatus)}</p>
            {h.note && <p className="mt-1 break-words text-sm leading-6 text-muted">{h.note}</p>}
            <p className="mt-1 text-sm leading-6 text-muted">
              {dateLabel(h.at)} · {timeLabel(h.at)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
