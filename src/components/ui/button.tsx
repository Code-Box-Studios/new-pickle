import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-sm font-semibold whitespace-nowrap transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-out outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground active:bg-primary-pressed",
        primary: "bg-primary text-primary-foreground active:bg-primary-pressed",
        destructive: "bg-destructive text-white active:bg-destructive/90",
        danger: "bg-destructive text-white active:bg-destructive/90",
        outline:
          "border border-input bg-transparent text-foreground active:bg-secondary",
        secondary:
          "bg-secondary text-secondary-foreground active:bg-secondary/80",
        ghost: "text-foreground active:bg-secondary",
        link: "h-auto text-brand-700 underline-offset-4 active:underline",
        onDark: "bg-primary text-primary-foreground active:bg-primary-pressed",
        outlineOnDark:
          "border border-white/35 bg-transparent text-white active:bg-white/10",
      },
      size: {
        default: "h-11 px-[22px] py-2.5",
        md: "h-11 px-[22px] py-2.5",
        sm: "h-11 px-4",
        xs: "h-10 px-3 text-xs",
        lg: "h-12 px-6",
        icon: "size-11",
        "icon-xs": "size-10",
        "icon-sm": "size-11",
        "icon-lg": "size-12",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  block,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  const blocked = Boolean(disabled || loading);
  const spinner = loading ? (
    <Loader2 className="size-4 animate-spin" aria-hidden />
  ) : null;
  let content = (
    <>
      {spinner}
      {children}
    </>
  );
  if (asChild && React.isValidElement<React.ComponentProps<"a">>(children)) {
    content = React.cloneElement(children, {
      ...(blocked
        ? {
            onClick: (event: React.MouseEvent) => {
              event.preventDefault();
              event.stopPropagation();
            },
          }
        : {}),
      children: (
        <>
          {spinner}
          {children.props.children}
        </>
      ),
    });
  }
  return (
    <Comp
      {...props}
      onClick={
        asChild && blocked
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
            }
          : props.onClick
      }
      data-slot="button"
      data-variant={variant ?? "default"}
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={asChild ? undefined : blocked}
      aria-disabled={asChild && blocked ? true : undefined}
      aria-busy={loading || undefined}
      tabIndex={asChild && blocked ? -1 : props.tabIndex}
    >
      {content}
    </Comp>
  );
}
