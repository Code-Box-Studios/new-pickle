import { Check } from "lucide-react";
import { amenityLabel } from "@/lib/amenities";

export function Amenities({ amenities }: { amenities: string[] }) {
  if (amenities.length === 0) return null;
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
      {amenities.map((a) => (
        <li key={a} className="flex items-center gap-1.5 text-[13px] text-ink-soft">
          <Check className="size-3.5 shrink-0 text-brand-600" aria-hidden />
          <span className="truncate">{amenityLabel(a)}</span>
        </li>
      ))}
    </ul>
  );
}
