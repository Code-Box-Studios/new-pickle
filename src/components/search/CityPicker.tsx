"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { CityOption } from "@/lib/cities";
import { cn } from "@/lib/cn";

export function CityPicker({
  id,
  name,
  cities,
  value,
  onValueChange,
  className,
}: {
  id: string;
  name?: string;
  cities: CityOption[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const selected = cities.find((city) => city.value === value);
  return (
    <>
      {name && <input type="hidden" name={name} value={value} />}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full min-w-0 justify-between rounded-md bg-background px-3 text-base font-normal",
              className,
            )}
          >
            <span className="truncate">
              {selected?.value ?? value ?? "Choose a city"}
            </span>
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition-transform duration-200",
                open && "rotate-180",
              )}
              aria-hidden
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="w-(--radix-popover-trigger-width) overflow-hidden border-border/80 p-0"
          aria-label="Choose a Philippine city"
          onOpenAutoFocus={() => {
            requestAnimationFrame(() =>
              listRef.current
                ?.querySelector('[data-current="true"]')
                ?.scrollIntoView({ block: "nearest" }),
            );
          }}
        >
          <Command defaultValue={value} className="rounded-none">
            <div className="border-b border-border/60 p-2.5">
              <CommandInput
                placeholder="Search city or province…"
                aria-label="Search cities"
                className="h-10 min-w-0 rounded-none py-0 text-sm focus-visible:outline-none!"
                wrapperClassName="h-11 rounded-lg border border-border/70 bg-surface/80 px-3 transition-colors focus-within:border-brand-700/40 focus-within:bg-white"
              />
            </div>
            <CommandList
              ref={listRef}
              className="max-h-[min(288px,calc(var(--radix-popover-content-available-height)_-_4rem))] overscroll-contain px-1 pb-1 [scrollbar-color:var(--color-hairline-strong)_transparent] [scrollbar-width:thin]"
            >
              <CommandEmpty>No matching city. Try another name.</CommandEmpty>
              <CommandGroup
                heading="Philippine cities"
                className="p-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
              >
                {cities.map((city) => (
                  <CommandItem
                    key={city.value}
                    value={city.value}
                    data-current={city.value === value}
                    className="mb-0.5 gap-3 border border-transparent px-3 py-2.5 data-[selected=true]:border-brand-200/70 data-[selected=true]:bg-secondary/70 data-[current=true]:bg-secondary/70"
                    keywords={[
                      city.name,
                      city.province ?? "",
                      city.value
                        .normalize("NFD")
                        .replace(/\p{Diacritic}/gu, ""),
                    ]}
                    onSelect={() => {
                      onValueChange(city.value);
                      setOpen(false);
                    }}
                  >
                    <span className="min-w-0 flex-1 space-y-0.5">
                      <span className="block truncate font-medium">
                        {city.name}
                      </span>
                      {city.province && (
                        <span className="block text-xs text-muted-foreground">
                          {city.province}
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-full bg-brand-700 text-white",
                        city.value === value ? "opacity-100" : "opacity-0",
                      )}
                      aria-hidden
                    >
                      <Check className="size-3 text-white" />
                    </span>
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
