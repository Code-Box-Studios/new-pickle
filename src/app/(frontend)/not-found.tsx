import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { MapPin } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto grid min-h-[65dvh] max-w-md place-items-center px-6 py-12 text-center">
      <div>
        <div className="mx-auto mb-6 grid size-16 place-items-center rounded-lg bg-mist text-brand-700">
          <MapPin className="size-7" strokeWidth={1.5} aria-hidden />
        </div>
        <p className="eyebrow">404</p>
        <h1 className="mt-3 text-3xl font-medium tracking-tight text-ink">
          Page not found
        </h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          The court you&apos;re looking for isn&apos;t here.
        </p>
        <Link href="/" className={`mt-7 ${buttonVariants()}`}>
          Back to home
        </Link>
      </div>
    </div>
  );
}
