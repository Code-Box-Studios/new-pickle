import { cn } from "@/lib/cn";

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

/** Decorative court illustration; motion follows its entrance into the viewport. */
export function RallyScene({ className }: { className?: string }) {
  return (
    <div className={cn("rally-scene", className)} aria-hidden="true">
      <svg viewBox="0 0 560 280" fill="none" className="size-full">
        <rect x="50" y="12" width="460" height="256" rx="28" fill="#e3fcf7" />
        <rect x="77" y="30" width="406" height="220" rx="12" fill="#00684a" />
        <rect x="213" y="47" width="134" height="186" fill="#00513b" />
        <g stroke="#e3fcf7" strokeWidth="2.5">
          <rect x="94" y="47" width="372" height="186" />
          <path d="M213 47v186M347 47v186M94 140h119M347 140h119" />
          <path d="M280 38v204" strokeWidth="3" />
          <path d="M274 47v186M286 47v186" strokeOpacity=".3" strokeWidth="1" strokeDasharray="3 4" />
        </g>
        <circle cx="280" cy="38" r="4" fill="#e3fcf7" />
        <circle cx="280" cy="242" r="4" fill="#e3fcf7" />
        <path d="M162 90Q280 15 398 185" className="rally-trail" stroke="#b9f5d0" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 8" />
        <g className="rally-paddle rally-paddle-left">
          <g transform="translate(137 60) rotate(-25 25 35)">
            <rect x="3" y="2" width="44" height="58" rx="17" fill="#001e2b" />
            <rect x="8" y="7" width="34" height="46" rx="13" stroke="#71e8ab" strokeWidth="1.5" />
            <path d="M19 58h12v22a6 6 0 0 1-12 0z" fill="#001e2b" />
            <path d="M20 68h10M20 73h10M20 78h10" stroke="#71e8ab" strokeWidth="1.5" />
          </g>
        </g>
        <g className="rally-paddle rally-paddle-right">
          <g transform="translate(377 155) rotate(155 25 35)">
            <rect x="3" y="2" width="44" height="58" rx="17" fill="#b9f5d0" />
            <rect x="8" y="7" width="34" height="46" rx="13" stroke="#00684a" strokeWidth="1.5" />
            <path d="M19 58h12v22a6 6 0 0 1-12 0z" fill="#b9f5d0" />
            <path d="M20 68h10M20 73h10M20 78h10" stroke="#00684a" strokeWidth="1.5" />
          </g>
        </g>
        <g className="rally-ball">
          <ellipse cx="285" cy="109" rx="13" ry="5" fill="#001e2b" fillOpacity=".25" />
          <circle cx="280" cy="94" r="13" fill="#00ed64" stroke="#001e2b" strokeWidth="1.5" />
          <g fill="#00513b">
            <circle cx="275" cy="90" r="2" />
            <circle cx="285" cy="90" r="2" />
            <circle cx="280" cy="98" r="2" />
          </g>
        </g>
        <g stroke="#00684a" strokeOpacity=".25" strokeWidth="1.5">
          <path d="M21 62v14M14 69h14M532 210v14M525 217h14" />
          <circle cx="526" cy="65" r="4" />
          <circle cx="31" cy="215" r="3" />
        </g>
      </svg>
    </div>
  );
}
