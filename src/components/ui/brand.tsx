import { cn } from "@/lib/cn";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className={cn("size-10 shrink-0", className)}
      aria-hidden="true"
    >
      <rect x="1" y="1" width="46" height="46" rx="14" fill="#001e2b" />
      <rect x="1.5" y="1.5" width="45" height="45" rx="13.5" stroke="#71e8ab" strokeOpacity=".2" />
      <g className="brand-paddle" transform="rotate(-28 24 25)">
        <rect x="14" y="7" width="21" height="27" rx="9" fill="#00ed64" />
        <path d="M21 31h7v9a3.5 3.5 0 0 1-7 0z" fill="#00ed64" />
        <path d="M20 26V15h5a3.5 3.5 0 0 1 0 7h-5" stroke="#001e2b" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M22 36h5M22 39h5" stroke="#001e2b" strokeOpacity=".45" strokeWidth="1.2" />
      </g>
      <g className="brand-ball">
        <circle cx="36" cy="11.5" r="7" fill="#e3fcf7" stroke="#001e2b" strokeWidth="2" />
        <circle cx="34" cy="9.5" r="1.1" fill="#00684a" />
        <circle cx="38.5" cy="10.5" r="1.1" fill="#00684a" />
        <circle cx="35.8" cy="14" r="1.1" fill="#00684a" />
      </g>
    </svg>
  );
}

export function Brand({
  inverse,
  className,
}: {
  inverse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 text-xl font-semibold tracking-[-0.045em]",
        inverse ? "text-white" : "text-ink",
        className,
      )}
    >
      <BrandMark />
      <span>Pikol</span>
    </span>
  );
}
