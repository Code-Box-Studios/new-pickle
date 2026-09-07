"use client";

import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { cn } from "@/lib/cn";

type Tone = "default" | "success" | "error";
type ToastInput = { title: string; description?: string; tone?: Tone };
type ToastItem = ToastInput & { id: number };

const ToastContext = React.createContext<(t: ToastInput) => void>(() => {});

export function useToast() {
  return React.useContext(ToastContext);
}

const TONE_BAR: Record<Tone, string> = {
  default: "border-l-brand-500",
  success: "border-l-brand-600",
  error: "border-l-red-500",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const seq = React.useRef(0);

  const push = React.useCallback((t: ToastInput) => {
    seq.current += 1;
    const id = seq.current;
    setItems((prev) => [...prev, { ...t, id }]);
  }, []);

  const remove = (id: number) => setItems((prev) => prev.filter((i) => i.id !== id));

  return (
    <ToastContext.Provider value={push}>
      <ToastPrimitive.Provider swipeDirection="right" duration={5000}>
        {children}
        {items.map((item) => (
          <ToastPrimitive.Root
            key={item.id}
            onOpenChange={(open) => !open && remove(item.id)}
            className={cn(
              "rounded-xl border border-black/5 border-l-4 bg-white p-4 shadow-[var(--shadow-card)]",
              TONE_BAR[item.tone ?? "default"],
            )}
          >
            <ToastPrimitive.Title className="text-sm font-semibold text-ink">
              {item.title}
            </ToastPrimitive.Title>
            {item.description && (
              <ToastPrimitive.Description className="mt-0.5 text-sm text-muted">
                {item.description}
              </ToastPrimitive.Description>
            )}
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-0 right-0 z-[100] m-4 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
