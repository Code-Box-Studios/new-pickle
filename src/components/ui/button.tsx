import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap transition-[background-color,color,box-shadow,transform] duration-150 ease-out active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-brand-700 text-white hover:bg-brand-800 shadow-sm",
        secondary: "bg-brand-50 text-brand-800 hover:bg-brand-100",
        outline: "border border-line bg-white text-ink hover:bg-canvas hover:border-brand-200",
        ghost: "text-ink-soft hover:bg-mist hover:text-ink",
        danger: "bg-red-600 text-white hover:bg-red-700",
      },
      size: {
        sm: "h-11 px-4 text-sm",
        md: "h-12 px-5 text-sm",
        lg: "h-13 px-6 text-base",
        icon: "h-11 w-11",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";
