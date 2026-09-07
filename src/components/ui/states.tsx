import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Button } from "./button";

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
    <div className={cn("mx-auto max-w-sm py-14 text-center", className)}>
      {icon && (
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          {icon}
        </div>
      )}
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {description && <p className="mt-1.5 text-muted">{description}</p>}
      {action && (
        <div className="mt-5">
          <Link href={action.href}>
            <Button size="lg">{action.label}</Button>
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
    <div className="mx-auto max-w-sm py-14 text-center">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {description && <p className="mt-1.5 text-muted">{description}</p>}
      {onRetry && (
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
