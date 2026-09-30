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
  <div className="select-control relative">
    <select
      ref={ref}
      className={cn(
        "form-control appearance-none py-2.5 pl-4 pr-10",
        className,
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown
      className="select-chevron pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted"
      aria-hidden
    />
  </div>
));
Select.displayName = "Select";
