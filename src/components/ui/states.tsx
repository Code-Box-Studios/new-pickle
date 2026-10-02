import * as React from "react";
import Link from "next/link";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "./empty";
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
    <Empty className={cn("mx-auto max-w-md py-16 sm:py-20", className)}>
      <EmptyHeader>
        {icon && (
          <EmptyMedia
            variant="icon"
            className="size-16 bg-secondary text-brand-700"
          >
            {icon}
          </EmptyMedia>
        )}
        <EmptyTitle>
          <h2 className="text-xl font-medium">{title}</h2>
        </EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && (
        <EmptyContent>
          <Button asChild size="lg">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        </EmptyContent>
      )}
    </Empty>
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
      {description && (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {onRetry && (
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
