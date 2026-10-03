"use client";

import { usePathname } from "next/navigation";
import { Card } from "@/components/ui/card";
import { SETUP_STEPS } from "./setup-steps";

const MOBILE_TITLES = {
  details: "Venue details",
  photos: "Venue photos",
  courts: "Your courts",
  hours: "Opening hours",
  payments: "Payment methods",
  review: "Review your venue",
};

export function SetupStepPanel({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const index = SETUP_STEPS.findIndex((step) =>
    pathname.endsWith(`/${step.key}`),
  );
  const step = SETUP_STEPS[index];
  if (!step) return children;
  return (
    <div className="mt-5 space-y-4 lg:mt-9 lg:space-y-5">
      <div>
        <p className="hidden text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-700 lg:block">
          Step {index + 1} of 6 · {step.label}
        </p>
        <h2 className="text-xl font-medium tracking-tight text-ink lg:mt-2 lg:text-[28px]">
          <span className="lg:hidden">{MOBILE_TITLES[step.key]}</span>
          <span className="hidden lg:inline">{step.title}</span>
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground lg:mt-1.5">
          {step.description}
        </p>
      </div>
      {step.key === "details" ? (
        children
      ) : (
        <Card className="max-w-4xl border-line bg-white p-4 sm:p-5 lg:p-7">
          {children}
        </Card>
      )}
    </div>
  );
}
