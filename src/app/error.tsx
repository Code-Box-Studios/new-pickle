"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

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
    <div className="mx-auto grid min-h-[60dvh] max-w-sm place-items-center px-4 text-center">
      <div>
        <h1 className="text-xl font-bold text-ink">Something went wrong</h1>
        <p className="mt-2 text-muted">
          We hit a snag loading this page. Please try again.
        </p>
        <Button className="mt-5" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
