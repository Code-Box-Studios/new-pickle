"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="dialog-overlay fixed inset-0 z-50 bg-brand-950/45" />
      <DialogPrimitive.Content
        className={cn(
          "dialog-content fixed z-50 max-h-[90dvh] overflow-y-auto overscroll-contain bg-surface shadow-elevated focus:outline-none",
          // mobile: bottom sheet
          "inset-x-0 bottom-0 rounded-t-3xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]",
          // desktop: centered modal
          "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100%_-_3rem)] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:p-8",
          className,
        )}
      >
        <DialogPrimitive.Title className="pr-10 text-xl font-semibold tracking-tight text-ink">
          {title}
        </DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description className="mt-2 text-sm leading-relaxed text-muted">
            {description}
          </DialogPrimitive.Description>
        ) : (
          <DialogPrimitive.Description className="sr-only">
            {title}
          </DialogPrimitive.Description>
        )}
        <div className="mt-6">{children}</div>
        <DialogPrimitive.Close
          className="absolute right-4 top-4 grid size-11 place-items-center rounded-xl text-muted transition-colors hover:bg-mist hover:text-ink"
          aria-label="Close"
        >
          <X className="size-5" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
