import * as React from "react";
import { cn } from "@/lib/cn";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-11 w-full rounded-xl border border-black/10 bg-white px-3.5 text-[15px] text-ink placeholder:text-muted",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-transparent",
      "disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Field = ({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <label htmlFor={htmlFor} className="block text-sm font-medium text-ink-soft">
      {label}
    </label>
    {children}
    {error ? (
      <p className="text-sm text-red-600">{error}</p>
    ) : hint ? (
      <p className="text-sm text-muted">{hint}</p>
    ) : null}
  </div>
);
