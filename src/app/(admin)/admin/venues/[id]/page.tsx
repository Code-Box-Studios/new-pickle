import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import prisma from "@/lib/prisma";
import { Amenities } from "@/components/venue/Amenities";
import { VenueStatusBadge } from "@/components/venue-admin/VenueStatusBadge";
import { ReviewActions } from "@/components/admin/ReviewActions";
import { channelLabel } from "@/lib/payment";
import { pesos } from "@/lib/format";

export const metadata = { title: "Admin · Review venue" };

function minuteLabel(min: number): string {
  let h = Math.floor(min / 60);
  const m = min % 60;
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, "0")} ${ap}`;
}
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function AdminVenueReview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await prisma.venue.findUnique({
    where: { id },
    include: {
      owner: { select: { email: true, name: true } },
      courts: { orderBy: { sortOrder: "asc" }, include: { schedules: true } },
      paymentMethods: true,
      verification: true,
    },
  });
  if (!v) notFound();

  const hours = (v.courts.find((c) => c.active)?.schedules ?? [])
    .slice()
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin/venues" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Venues
      </Link>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">{v.name}</h1>
          <p className="text-sm text-muted">
            {v.owner.email} · {v.barangay ? `${v.barangay}, ` : ""}{v.city}
          </p>
        </div>
        <VenueStatusBadge status={v.status} />
      </div>

      {v.verification?.submittedNote && (
        <div className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm text-ink-soft">
          <strong>Owner&apos;s note:</strong> {v.verification.submittedNote}
        </div>
      )}

      {v.photos.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {v.photos.slice(0, 6).map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={p} alt={`Photo ${i + 1}`} className="aspect-square w-full rounded-lg object-cover" />
          ))}
        </div>
      )}

      {v.description && <p className="mt-4 text-ink-soft">{v.description}</p>}

      {v.amenities.length > 0 && (
        <div className="mt-4">
          <h2 className="text-sm font-semibold text-ink">Amenities</h2>
          <div className="mt-2"><Amenities amenities={v.amenities} /></div>
        </div>
      )}

      <div className="mt-4">
        <h2 className="text-sm font-semibold text-ink">Courts</h2>
        <ul className="mt-2 space-y-1 text-sm text-ink-soft">
          {v.courts.map((c) => (
            <li key={c.id}>
              {c.name} — {c.indoor ? "Indoor" : "Outdoor"} · {pesos(c.priceCents)}/hr {!c.active && "(inactive)"}
            </li>
          ))}
          {v.courts.length === 0 && <li className="text-muted">No courts.</li>}
        </ul>
      </div>

      <div className="mt-4">
        <h2 className="text-sm font-semibold text-ink">Hours</h2>
        <ul className="mt-2 text-sm text-ink-soft">
          {hours.length === 0 && <li className="text-muted">No hours set.</li>}
          {hours.map((s) => (
            <li key={s.id}>{DAYS[s.dayOfWeek]} {minuteLabel(s.openMinute)} – {minuteLabel(s.closeMinute)}</li>
          ))}
        </ul>
      </div>

      <div className="mt-4">
        <h2 className="text-sm font-semibold text-ink">Payment methods</h2>
        <ul className="mt-2 text-sm text-ink-soft">
          {v.paymentMethods.map((m) => (
            <li key={m.id}>{channelLabel(m.channel)} · {m.accountName} · {m.accountNumber}</li>
          ))}
          {v.paymentMethods.length === 0 && <li className="text-muted">None.</li>}
        </ul>
      </div>

      <div className="mt-6 rounded-2xl border border-black/5 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">Decision</h2>
        <ReviewActions venueId={v.id} status={v.status} />
      </div>
    </div>
  );
}
