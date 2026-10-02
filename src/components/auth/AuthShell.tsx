import type { ReactNode } from "react";
import { CalendarCheck, MapPin, Wallet } from "lucide-react";
import { BrandMark } from "@/components/ui/brand";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CourtPattern, PaddleIcon, PickleballIcon } from "@/components/ui/pickleball";

const BENEFITS = [
  { icon: MapPin, title: "Find your court", detail: "Discover places to play across the Philippines." },
  { icon: CalendarCheck, title: "Keep your plans together", detail: "Your reservations, all in one place." },
  { icon: Wallet, title: "Pay the venue directly", detail: "Book here. Settle up with your venue." },
];

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="hero-band relative -mb-24 overflow-hidden px-4 pb-10 pt-28 sm:px-6 sm:pb-16 sm:pt-32 md:mb-0 lg:px-8 lg:pt-36">
      <CourtPattern className="pointer-events-none absolute -right-52 top-12 w-[900px] rotate-[-28deg] text-brand-300 opacity-[0.055]" />
      <div className="relative mx-auto grid max-w-[1060px] items-center gap-12 lg:min-h-[560px] lg:grid-cols-[1.05fr_1fr] lg:gap-16 xl:gap-24">
        <aside className="motion-enter hidden min-w-0 lg:block" aria-labelledby="auth-intro-title">
          <Badge variant="outline" className="mb-6 gap-2 border-white/20 bg-white/5 px-3.5 py-2 text-white/85">
            <PickleballIcon /> A little more game time
          </Badge>
          <h2 id="auth-intro-title" className="text-[48px] font-medium leading-[1.12] tracking-[-1.5px] text-white">
            Less planning.<br /><span className="text-brand-200">More playing.</span>
          </h2>
          <p className="mt-5 max-w-sm text-base leading-relaxed text-white/65">
            From the first serve to your next match, make room for the game you love.
          </p>
          <div className="relative my-8 flex h-36 max-w-sm items-center justify-center" aria-hidden="true">
            <svg viewBox="0 0 380 140" fill="none" className="absolute inset-0 size-full text-brand-300/30">
              <path d="M18 102C88 128 118 10 190 36S276 142 364 38" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 7" />
              <ellipse cx="190" cy="70" rx="73" ry="61" stroke="currentColor" strokeWidth="1" />
            </svg>
            <PaddleIcon className="absolute left-3 top-14 size-16 -rotate-12 text-brand-300/60" />
            <BrandMark className="relative size-28 -rotate-[8deg] shadow-[0_20px_60px_-20px_rgba(0,237,100,0.3)]" />
            <PickleballIcon className="absolute right-5 top-6 size-12 rotate-12 text-brand-200" />
          </div>
          <ul className="space-y-5 border-t border-white/10 pt-6">
            {BENEFITS.map(({ icon: Icon, title, detail }) => (
              <li key={title} className="flex items-start gap-3.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full border border-brand-300/15 bg-brand-300/5 text-brand-300">
                  <Icon className="size-4" strokeWidth={1.7} aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-medium text-white">{title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-white/55">{detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </aside>
        <Card className="motion-enter motion-delay-1 mx-auto w-full min-w-0 max-w-[480px] border-white/80 p-6 shadow-elevated sm:p-9 lg:p-10">
          {children}
        </Card>
      </div>
    </div>
  );
}
