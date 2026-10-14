import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, MapPin, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { longDateLabel, timeLabel } from "@/lib/format";
import type {
  Attendance,
  SessionBookingView,
  Verification,
} from "@/lib/players/types";

export function PlayerShell({
  title,
  description,
  children,
  back,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="page-shell min-w-0 py-8 sm:py-12">
      <div className="mx-auto min-w-0 max-w-5xl">
        {back && (
          <Link
            href={back.href}
            className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-brand-700"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {back.label}
          </Link>
        )}
        <div className="mb-7">
          <h1 className="page-title mb-2">{title}</h1>
          {description && (
            <p className="max-w-2xl text-sm leading-relaxed text-ink-soft sm:text-base">
              {description}
            </p>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

export function PlayerError({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
    >
      <p className="min-w-0 break-words">{message}</p>
      {retry && (
        <Button variant="outline" size="sm" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function PlayerLoading() {
  return (
    <Card role="status" aria-live="polite" className="rounded-xl bg-white p-6">
      <p className="text-sm text-ink-soft">Loading player details…</p>
    </Card>
  );
}

export function PlayerPrivacy() {
  return (
    <p className="flex items-start gap-2 text-sm leading-relaxed text-ink-soft">
      <ShieldCheck
        className="mt-0.5 size-4 shrink-0 text-brand-700"
        aria-hidden
      />
      <span>
        Your profile, history, and totals are private. Session participants can
        see only their shared roster and games.
      </span>
    </p>
  );
}

export function PlayerBookingFacts({
  booking,
}: {
  booking: Pick<
    SessionBookingView,
    "venueName" | "courtName" | "startsAt" | "endsAt"
  >;
}) {
  return (
    <div className="space-y-2 text-sm text-ink-soft">
      <p className="flex items-start gap-2">
        <MapPin className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden />
        <span className="min-w-0 break-words font-semibold text-ink">
          {booking.venueName} · {booking.courtName}
        </span>
      </p>
      <p className="flex items-start gap-2">
        <CalendarDays
          className="mt-0.5 size-4 shrink-0 text-brand-700"
          aria-hidden
        />
        <span>
          {longDateLabel(new Date(booking.startsAt))}
          <br />
          {timeLabel(new Date(booking.startsAt))} –{" "}
          {timeLabel(new Date(booking.endsAt))} · Philippine time
        </span>
      </p>
    </div>
  );
}

export function AttendanceBadge({ attendance }: { attendance: Attendance }) {
  return (
    <Badge
      tone={
        attendance === "ATTENDED"
          ? "brand"
          : attendance === "ABSENT"
            ? "neutral"
            : "amber"
      }
    >
      {attendance === "ATTENDED"
        ? "Attended"
        : attendance === "ABSENT"
          ? "Absent"
          : "Attendance unconfirmed"}
    </Badge>
  );
}

const verificationLabels: Record<Verification, string> = {
  PEER_CONFIRMED: "Peer-confirmed",
  SELF_REPORTED: "Self-reported",
  PENDING: "Awaiting confirmations",
  DISPUTED: "Disputed",
  UNFINISHED: "Unfinished",
};
export function MatchVerification({
  verification,
}: {
  verification: Verification;
}) {
  return (
    <Badge
      tone={
        verification === "PEER_CONFIRMED"
          ? "brand"
          : verification === "DISPUTED"
            ? "red"
            : verification === "PENDING"
              ? "amber"
              : "neutral"
      }
    >
      {verificationLabels[verification]}
    </Badge>
  );
}
