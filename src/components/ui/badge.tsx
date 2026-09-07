import * as React from "react";
import type { BookingStatus } from "@/generated/prisma";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "brand" | "amber" | "blue" | "red";

const TONE: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  brand: "bg-brand-100 text-brand-800",
  amber: "bg-amber-100 text-amber-800",
  blue: "bg-sky-100 text-sky-800",
  red: "bg-red-100 text-red-700",
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
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        TONE[tone],
        className,
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", DOT[tone])} aria-hidden />}
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
