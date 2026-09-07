import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * A styled native <select>. Native pickers are the best mobile UX and need no
 * client JS — a good default for the marketplace's simple choice inputs.
 */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(
        "h-11 w-full appearance-none rounded-xl border border-black/10 bg-white pl-3.5 pr-9 text-[15px] text-ink",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-transparent",
        "disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown
      className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted"
      aria-hidden
    />
  </div>
));
Select.displayName = "Select";
