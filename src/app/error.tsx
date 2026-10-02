"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CircleAlert } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto grid min-h-[65dvh] max-w-md place-items-center px-6 py-12 text-center"
    >
      <div>
        <div className="mx-auto mb-6 grid size-16 place-items-center rounded-lg bg-amber-50 text-amber-800">
          <CircleAlert className="size-7" strokeWidth={1.5} aria-hidden />
        </div>
        <h1 className="text-2xl font-medium tracking-tight text-ink">
          Something went wrong
        </h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          We hit a snag loading this page. Please try again.
        </p>
        <Button className="mt-7" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
