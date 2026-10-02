"use client";

import { useId, useState, type AriaAttributes } from "react";
import { format, isValid, parse } from "date-fns";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/cn";

export function DatePicker({
  id,
  name,
  value,
  onValueChange,
  className,
  disabled,
  ...aria
}: AriaAttributes & {
  id?: string;
  name?: string;
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  const generatedId = useId();
  const [open, setOpen] = useState(false);
  // Calendar dates are local civil days; UTC conversion can shift a chosen day.
  const parsed = parse(value, "yyyy-MM-dd", new Date());
  const selected = isValid(parsed) ? parsed : undefined;

  return (
    <>
      {name && <input type="hidden" name={name} value={value} disabled={disabled} />}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            {...aria}
            id={id ?? generatedId}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn("w-full min-w-0 justify-between rounded-md bg-background px-3 text-base font-normal", className)}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <CalendarDays className="size-4 text-brand-700" aria-hidden />
              <span className="truncate">{selected ? format(selected, "MMM d, yyyy") : "Choose a date"}</span>
            </span>
            <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={8} collisionPadding={12} className="max-h-(--radix-popover-content-available-height) w-80 overflow-y-auto overscroll-contain p-0" aria-label="Choose a date">
          <Calendar
            mode="single"
            required
            selected={selected}
            defaultMonth={selected}
            autoFocus
            onSelect={(day) => {
              if (!day) return;
              onValueChange(format(day, "yyyy-MM-dd"));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </>
  );
}
