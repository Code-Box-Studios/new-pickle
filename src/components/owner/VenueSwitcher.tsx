"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SelectField, SelectItem } from "@/components/ui/select";
import type { OwnerVenueRef } from "@/lib/venue/owner-context";

export function VenueSwitcher({
  venues,
  activeId,
}: {
  venues: OwnerVenueRef[];
  activeId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  if (venues.length <= 1) return null;

  function onChange(value: string) {
    const p = new URLSearchParams(sp.toString());
    p.set("venue", value);
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <div className="w-full sm:w-64">
      <SelectField
        value={activeId}
        onValueChange={onChange}
        aria-label="Select venue"
      >
        {venues.map((v) => (
          <SelectItem key={v.id} value={String(v.id)}>
            {v.name}
          </SelectItem>
        ))}
      </SelectField>
    </div>
  );
}
