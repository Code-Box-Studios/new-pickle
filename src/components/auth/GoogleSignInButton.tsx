"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function GoogleSignInButton({ nextPath, audience }: { nextPath?: string; audience: "player" | "owner" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signIn() {
    if (loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const response = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ next: nextPath, audience }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok || typeof data.url !== "string") throw new Error("Google sign-in unavailable");
      router.push(data.url);
    } catch {
      setLoading(false);
      setFailed(true);
    }
  }

  return <div className="mb-6 space-y-4">
    <Button type="button" variant="outline" size="lg" block loading={loading} loadingLabel="Opening Google…" onClick={signIn}>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="currentColor">
        <path d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.61 4.61 0 0 1-2 3.02v2.51h3.24c1.89-1.74 2.98-4.31 2.98-7.36Z" />
        <path d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.97-3.38.97-2.6 0-4.8-1.76-5.59-4.13H3.07v2.59A10 10 0 0 0 12 22Z" />
        <path d="M6.41 13.92A6 6 0 0 1 6.1 12c0-.67.12-1.31.31-1.92V7.49H3.07A10 10 0 0 0 2 12c0 1.61.39 3.14 1.07 4.51l3.34-2.59Z" />
        <path d="M12 5.95c1.47 0 2.78.51 3.82 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59C7.2 7.71 9.4 5.95 12 5.95Z" />
      </svg>
      Continue with Google
    </Button>
    {failed && <p role="alert" className="text-sm leading-relaxed text-destructive">Google sign-in couldn’t start. Try again or use email or phone below.</p>}
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-line" /><span>or</span><span className="h-px flex-1 bg-line" />
    </div>
  </div>;
}
