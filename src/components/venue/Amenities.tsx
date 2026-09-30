import { Check } from "lucide-react";
import { amenityLabel } from "@/lib/amenities";

export function Amenities({ amenities }: { amenities: string[] }) {
  if (amenities.length === 0) return null;
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-3">
      {amenities.map((a) => (
        <li key={a} className="flex items-start gap-2 text-sm leading-5 text-ink-soft">
          <Check className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden />
          <span className="min-w-0 break-words">{amenityLabel(a)}</span>
        </li>
      ))}
    </ul>
  );
}
