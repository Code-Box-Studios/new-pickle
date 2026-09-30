import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Button, buttonVariants } from "./button";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; href: string };
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-md px-4 py-16 text-center sm:py-20", className)}>
      {icon && (
        <div className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-mist text-brand-700">
          {icon}
        </div>
      )}
      <h2 className="text-xl font-semibold tracking-tight text-ink">{title}</h2>
      {description && <p className="mt-3 text-sm leading-relaxed text-muted">{description}</p>}
      {action && (
        <div className="mt-6">
          <Link href={action.href} className={buttonVariants({size: "lg"})}>
            {action.label}
          </Link>
        </div>
      )}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="mx-auto max-w-md px-4 py-16 text-center">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {description && <p className="mt-3 text-sm leading-relaxed text-muted">{description}</p>}
      {onRetry && (
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
