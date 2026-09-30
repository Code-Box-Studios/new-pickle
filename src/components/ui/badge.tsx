import * as React from "react";
import type { BookingStatus } from "@/generated/prisma";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "brand" | "amber" | "blue" | "red";

const TONE: Record<Tone, string> = {
  neutral: "bg-canvas text-ink-soft",
  brand: "bg-brand-100 text-brand-800",
  amber: "bg-amber-50 text-amber-900",
  blue: "bg-sky-50 text-sky-800",
  red: "bg-red-50 text-red-800",
};
const DOT: Record<Tone, string> = {
  neutral: "bg-slate-400",
  brand: "bg-brand-500",
  amber: "bg-amber-500",
  blue: "bg-sky-500",
  red: "bg-red-500",
};

export function Badge({
  tone = "neutral",
  dot,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium leading-snug",
        TONE[tone],
        className,
      )}
    >
      {dot && <span className={cn("size-1.5 shrink-0 rounded-full", DOT[tone])} aria-hidden />}
      {children}
    </span>
  );
}

const STATUS: Record<BookingStatus, { label: string; tone: Tone }> = {
  HELD: { label: "Held", tone: "amber" },
  PENDING_PAYMENT: { label: "Awaiting payment", tone: "amber" },
  PAYMENT_SUBMITTED: { label: "Payment submitted", tone: "blue" },
  PENDING_CONFIRMATION: { label: "Awaiting venue confirmation", tone: "amber" },
  CONFIRMED: { label: "Confirmed", tone: "brand" },
  EXPIRED: { label: "Expired", tone: "neutral" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
  REJECTED: { label: "Rejected", tone: "red" },
  COMPLETED: { label: "Completed", tone: "brand" },
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const meta = STATUS[status];
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
}
