"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { CityOption } from "@/lib/cities";
import { cn } from "@/lib/cn";

export function CityPicker({ id, name, cities, value, onValueChange }: {
  id: string;
  name?: string;
  cities: CityOption[];
  value: string;
  onValueChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = cities.find(city => city.value === value);
  return (
    <>
      {name && <input type="hidden" name={name} value={value} />}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full min-w-0 justify-between rounded-md bg-background px-3 text-base font-normal">
            <span className="truncate">{selected?.value ?? value ?? "Choose a city"}</span>
            <ChevronsUpDown className="size-4 text-muted-foreground" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={8} collisionPadding={12} className="w-[max(320px,var(--radix-popover-trigger-width))] p-0" aria-label="Choose a Philippine city">
          <Command>
            <CommandInput placeholder="Search city or province…" aria-label="Search cities" />
            <CommandList className="max-h-[min(320px,calc(var(--radix-popover-content-available-height)_-_3rem))] overscroll-contain">
              <CommandEmpty>No matching city. Try another name.</CommandEmpty>
              <CommandGroup heading="Philippine cities">
                {cities.map(city => (
                  <CommandItem key={city.value} value={city.value} keywords={[city.name, city.province ?? "", city.value.normalize("NFD").replace(/\p{Diacritic}/gu, "")]} onSelect={() => {
                    onValueChange(city.value);
                    setOpen(false);
                  }}>
                    <MapPin className="size-4 text-brand-700" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{city.name}</span>
                      {city.province && <span className="block text-xs text-muted-foreground">{city.province}</span>}
                    </span>
                    <Check className={cn("size-4 text-brand-700", city.value === value ? "opacity-100" : "opacity-0")} aria-hidden />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
