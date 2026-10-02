import { BrandMark } from "@/components/ui/brand";
import { PaddleIcon, PickleballIcon } from "@/components/ui/pickleball";

/** Decorative platform branding, independent of venue listings. */
export function BrandShowcase() {
  return (
    <div className="brand-showcase relative isolate mx-auto aspect-[5/4] w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025] sm:aspect-[3/2] lg:aspect-[5/4]" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,237,100,0.1),transparent_65%)]" />
      <svg viewBox="0 0 500 400" fill="none" className="absolute inset-0 size-full text-brand-300">
        <circle cx="250" cy="180" r="100" stroke="currentColor" strokeOpacity=".15" />
        <circle cx="250" cy="180" r="155" stroke="currentColor" strokeOpacity=".09" strokeDasharray="3 9" />
        <ellipse cx="250" cy="180" rx="230" ry="126" transform="rotate(-28 250 180)" stroke="currentColor" strokeOpacity=".13" />
        <path d="M66 240c26 42 82 70 148 78M307 45c54 8 96 32 121 64" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeOpacity=".3" />
        <circle cx="66" cy="240" r="4" fill="currentColor" fillOpacity=".6" />
        <circle cx="428" cy="109" r="4" fill="currentColor" fillOpacity=".6" />
      </svg>
      <PaddleIcon className="brand-showcase-paddle absolute left-[8%] top-[45%] size-16 rotate-[-28deg] text-brand-300/65 sm:size-20 lg:size-24" />
      <PaddleIcon className="absolute right-[9%] top-[12%] size-12 rotate-[145deg] text-brand-300/35 sm:size-16 lg:size-20" />
      <PickleballIcon className="brand-showcase-ball absolute right-[13%] top-[57%] size-8 text-primary sm:size-10" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 pb-3 sm:gap-7">
        <div className="brand-showcase-mark -rotate-6 rounded-[30%] shadow-[0_24px_64px_-12px_rgba(0,0,0,0.35)]">
          <BrandMark className="size-24 sm:size-32 lg:size-40" />
        </div>
        <span className="text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl lg:text-5xl">Rally<span className="font-normal">Point</span></span>
        <span className="h-0.5 w-16 rounded-full bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
      </div>
    </div>
  );
}
