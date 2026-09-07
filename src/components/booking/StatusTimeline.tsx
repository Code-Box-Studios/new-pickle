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
    <ol className="space-y-3">
      {history.map((h, i) => (
        <li key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="mt-1 size-2 rounded-full bg-brand-500" aria-hidden />
            {i < history.length - 1 && <span className="w-px flex-1 bg-black/10" aria-hidden />}
          </div>
          <div className="pb-1">
            <p className="text-sm font-medium text-ink">{humanize(h.toStatus)}</p>
            {h.note && <p className="text-xs text-muted">{h.note}</p>}
            <p className="text-xs text-muted">
              {dateLabel(h.at)} · {timeLabel(h.at)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
