"use client";

import { usePathname } from "next/navigation";
import { Card } from "@/components/ui/card";
import { SETUP_STEPS } from "./setup-steps";

export function SetupStepPanel({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const index = SETUP_STEPS.findIndex((step) =>
    pathname.endsWith(`/${step.key}`),
  );
  const step = SETUP_STEPS[index];
  if (!step) return children;
  return (
    <div className="mt-7 space-y-5 sm:mt-9">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-700">
          Step {index + 1} of 6 · {step.label}
        </p>
        <h2 className="mt-2 text-2xl font-medium tracking-tight text-ink sm:text-[28px]">
          {step.title}
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {step.description}
        </p>
      </div>
      {step.key === "details" ? (
        children
      ) : (
        <Card className="max-w-4xl border-line bg-white p-5 sm:p-7">
          {children}
        </Card>
      )}
    </div>
  );
}
