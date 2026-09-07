"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";
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

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const p = new URLSearchParams(sp.toString());
    p.set("venue", e.target.value);
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <div className="w-full max-w-xs">
      <Select value={activeId} onChange={onChange} aria-label="Select venue">
        {venues.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
