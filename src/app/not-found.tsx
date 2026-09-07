import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto grid min-h-[60dvh] max-w-sm place-items-center px-4 text-center">
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
          404
        </p>
        <h1 className="mt-2 text-xl font-bold text-ink">Page not found</h1>
        <p className="mt-2 text-muted">
          The court you&apos;re looking for isn&apos;t here.
        </p>
        <Link href="/" className="mt-5 inline-block">
          <Button>Back to home</Button>
        </Link>
      </div>
    </div>
  );
}
