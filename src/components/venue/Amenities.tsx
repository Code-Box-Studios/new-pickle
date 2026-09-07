import { Check } from "lucide-react";
import { amenityLabel } from "@/lib/amenities";

export function Amenities({ amenities }: { amenities: string[] }) {
  if (amenities.length === 0) return null;
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {amenities.map((a) => (
        <li key={a} className="flex items-center gap-2 text-sm text-ink-soft">
          <Check className="size-4 text-brand-600" aria-hidden />
          {amenityLabel(a)}
        </li>
      ))}
    </ul>
  );
}
