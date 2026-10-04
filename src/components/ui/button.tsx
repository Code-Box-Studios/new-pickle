import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

const primaryStyles =
  "button-primary overflow-hidden border border-transparent bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_2px_6px_-2px_rgb(0_104_74/0.18)] active:bg-primary-pressed";

const destructiveStyles =
  "button-destructive border border-transparent bg-destructive text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_2px_6px_-2px_rgb(180_35_24/0.16)] hover:bg-destructive/95 active:bg-destructive/90";

export const buttonVariants = cva(
  "ui-button relative isolate inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-sm font-semibold whitespace-nowrap transition-[color,background-color,border-color,box-shadow,transform,text-decoration-color] duration-200 active:duration-100 ease-[cubic-bezier(0.22,1,0.36,1)] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:aria-busy:opacity-100 aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-disabled:aria-busy:opacity-100 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: primaryStyles,
        primary: primaryStyles,
        destructive: destructiveStyles,
        danger: destructiveStyles,
        outline:
          "button-outline border border-input bg-white/60 text-foreground shadow-[0_1px_2px_rgb(0_30_43/0.03)] hover:border-brand-700/40 hover:bg-secondary/50 active:bg-secondary",
        secondary:
          "button-secondary border border-brand-200/60 bg-secondary text-secondary-foreground hover:border-brand-700/25 hover:bg-secondary/80 active:bg-secondary/65",
        ghost:
          "button-ghost text-foreground hover:bg-secondary/60 active:bg-secondary",
        link: "button-link h-auto text-brand-700 underline decoration-brand-700/25 underline-offset-4 hover:decoration-current active:text-brand-700/80",
        onDark: `${primaryStyles} focus-visible:ring-offset-brand-950`,
        outlineOnDark:
          "button-outline-dark border border-white/35 bg-white/[0.025] text-white hover:border-white/60 hover:bg-white/[0.08] active:bg-white/15 focus-visible:ring-offset-brand-950",
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
  loadingLabel?: string;
}

export function Button({
  className,
  variant,
  size,
  block,
  asChild = false,
  loading = false,
  loadingLabel,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  const blocked = Boolean(disabled || loading);
  // Keep the idle content in the layout so loading never changes the width.
  // The overlay replaces it visually, including any existing action icons.
  function loadingContent(idleContent: React.ReactNode) {
    if (!loading) return idleContent;
    return (
      <>
        <span className="inline-flex items-center justify-center gap-2 opacity-0">
          {idleContent}
        </span>
        <span aria-hidden className="absolute inset-0 inline-flex items-center justify-center gap-2 animate-in fade-in duration-150 motion-reduce:animate-none">
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
          {loadingLabel}
        </span>
      </>
    );
  }
  let content = loadingContent(children);
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
      children: loadingContent(children.props.children),
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
