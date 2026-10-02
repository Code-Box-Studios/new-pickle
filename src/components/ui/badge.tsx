import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
import type { BookingStatus } from "@/generated/prisma";
import { Slot } from "radix-ui";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2.5 py-1 text-[13px] font-semibold transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "bg-destructive text-white focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 [a&]:hover:bg-destructive/90",
        outline:
          "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-brand-700 underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  asChild = false,
  tone,
  dot,
  children,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
    tone?: Tone;
    dot?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(
        badgeVariants({ variant: tone ? "ghost" : variant }),
        tone && TONE[tone],
        className,
      )}
      {...props}
    >
      {dot && (
        <span
          className="size-1.5 shrink-0 rounded-full bg-current"
          aria-hidden
        />
      )}
      {children}
    </Comp>
  );
}

export { Badge, badgeVariants };

type Tone = "neutral" | "brand" | "amber" | "blue" | "red";
const TONE: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  brand: "bg-secondary text-brand-700",
  amber: "bg-warning text-warning-foreground",
  blue: "bg-secondary text-brand-teal-deep",
  red: "bg-destructive/10 text-destructive",
};

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
