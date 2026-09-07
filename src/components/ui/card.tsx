import * as React from "react";
import { cn } from "@/lib/cn";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-black/5 bg-white shadow-[var(--shadow-card)]",
        className,
      )}
      {...props}
    />
  );
}
