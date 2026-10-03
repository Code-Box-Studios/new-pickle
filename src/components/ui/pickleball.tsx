import { cn } from "@/lib/cn";

export { RallyScene } from "./rally-scene";

export function PickleballIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("size-5", className)} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <g fill="currentColor">
        <ellipse cx="8" cy="8" rx="1.3" ry="1.6" transform="rotate(-35 8 8)" />
        <ellipse cx="16" cy="8" rx="1.3" ry="1.6" transform="rotate(35 16 8)" />
        <circle cx="12" cy="12" r="1.6" />
        <ellipse cx="8" cy="16" rx="1.3" ry="1.6" transform="rotate(35 8 16)" />
        <ellipse cx="16" cy="16" rx="1.3" ry="1.6" transform="rotate(-35 16 16)" />
      </g>
    </svg>
  );
}

export function PaddleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("size-5", className)} aria-hidden="true">
      <g transform="rotate(-30 12 12)" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="6" y="2" width="12" height="14" rx="5" />
        <path d="M10 16v4a2 2 0 0 0 4 0v-4M10 19h4M9 6h6M9 9h6" />
      </g>
    </svg>
  );
}

export function CourtPattern({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 320" fill="none" className={className} aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.5">
        <rect x="30" y="30" width="540" height="260" rx="4" />
        <path d="M215 30v260M385 30v260M300 20v280M30 160h185M385 160h185" />
        <path d="M292 30v260M308 30v260" strokeDasharray="2 5" strokeOpacity=".5" />
      </g>
    </svg>
  );
}
