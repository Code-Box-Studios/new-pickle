"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export interface FeaturedCourtSlide {
  slug: string;
  name: string;
  city: string;
  photo: string;
}

const motionQuery = "(prefers-reduced-motion: reduce)";

function subscribeToMotion(change: () => void) {
  const query = window.matchMedia(motionQuery);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
}

function prefersReducedMotion() {
  return window.matchMedia(motionQuery).matches;
}

function subscribeToVisibility(change: () => void) {
  document.addEventListener("visibilitychange", change);
  return () => document.removeEventListener("visibilitychange", change);
}

function isTabHidden() {
  return document.hidden;
}

function realPosition(index: number, count: number) {
  return ((index - 1 + count) % count) + 1;
}

export function FeaturedCourtsSlideshow({ courts, isoDate }: { courts: FeaturedCourtSlide[]; isoDate: string }) {
  const [slide, setSlide] = useState({ index: 1, moving: false });
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const reducedMotion = useSyncExternalStore(subscribeToMotion, prefersReducedMotion, () => true);
  const hidden = useSyncExternalStore(subscribeToVisibility, isTabHidden, () => true);
  const count = courts.length;
  const currentIndex = count ? realPosition(slide.index, count) - 1 : 0;
  const suspended = hovered || focused || hidden || reducedMotion;

  const finishMotion = useCallback(() => {
    setSlide((previous) => previous.moving && count > 1
      ? { index: realPosition(previous.index, count), moving: false }
      : previous);
  }, [count]);

  useEffect(() => {
    if (count < 2 || suspended) return;
    const timer = window.setTimeout(() => {
      setSlide((previous) => ({ index: realPosition(previous.index, count) + 1, moving: true }));
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [count, currentIndex, suspended]);

  useEffect(() => {
    if (!slide.moving || count < 2) return;
    // Also settle when a reduced-motion or hidden-tab transition emits no event.
    const timer = window.setTimeout(finishMotion, 300);
    return () => window.clearTimeout(timer);
  }, [count, slide.index, slide.moving, finishMotion]);

  if (count === 0) return null;
  const current = courts[currentIndex];
  const renderedCourts = count > 1 ? [courts[count - 1], ...courts, courts[0]] : courts;
  const trackIndex = count > 1 ? (slide.index <= count + 1 ? slide.index : currentIndex + 1) : 0;

  function select(index: number) {
    setSlide((previous) => {
      if (previous.moving && (previous.index === 0 || previous.index === count + 1)) return previous;
      return { index, moving: !reducedMotion };
    });
  }

  function move(direction: number) {
    setSlide((previous) => {
      if (previous.moving && (previous.index === 0 || previous.index === count + 1)) return previous;
      const index = realPosition(previous.index, count) + direction;
      return { index: reducedMotion ? realPosition(index, count) : index, moving: !reducedMotion };
    });
  }

  return (
    <section
      aria-label="Featured courts"
      aria-roledescription={count > 1 ? "carousel" : undefined}
      className="court-photo-hover min-w-0"
      onMouseEnter={() => {
        if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) setHovered(true);
      }}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      onKeyDown={(event) => {
        if (count < 2 || event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          move(event.key === "ArrowLeft" ? -1 : 1);
        }
      }}
    >
      <div className="court-photo-card relative aspect-[16/10] w-full rounded-[2rem] bg-mist lg:aspect-[5/4]">
        <Link
          href={`/venues/${current.slug}?date=${isoDate}`}
          aria-label={`View ${current.name} in ${current.city}`}
          className="motion-trigger relative block size-full rounded-[inherit] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600"
        >
          <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
            <div
              className="court-slideshow-track"
              data-moving={slide.moving ? "true" : undefined}
              style={{ transform: `translateX(-${trackIndex * 100}%)` }}
              onTransitionEnd={(event) => {
                if (event.target === event.currentTarget && event.propertyName === "transform") finishMotion();
              }}
            >
          {renderedCourts.map((court, index) => {
            const clone = count > 1 && (index === 0 || index === renderedCourts.length - 1);
            const sourceIndex = count > 1 ? (index - 1 + count) % count : index;
            const active = !clone && sourceIndex === currentIndex;
            const initialPhoto = index === (count > 1 ? 1 : 0);
            return (
              <div
                key={`${court.slug}-${index}`}
                role="group"
                aria-roledescription="slide"
                aria-label={`${sourceIndex + 1} of ${count}`}
                aria-hidden={!active}
                inert={!active}
                className="relative h-full w-full min-w-0 shrink-0"
              >
                  {/* eslint-disable-next-line @next/next/no-img-element -- existing venue media URLs */}
                  <img src={court.photo} alt={court.name} className="court-photo-image size-full object-cover" loading={initialPhoto ? "eager" : "lazy"} fetchPriority={initialPhoto ? "high" : "auto"} decoding="async" />
              </div>
            );
          })}
            </div>
          </div>
          <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3 rounded-2xl bg-white/95 p-4 shadow-card sm:inset-x-5 sm:bottom-5 sm:gap-4 sm:p-5">
            <div className="min-w-0">
              <p className="text-xs text-muted">Find your next court</p>
              <p className="mt-1 truncate text-base font-semibold tracking-tight text-ink">{current.name}</p>
              <p className="mt-1 truncate text-xs text-muted">{current.city}</p>
            </div>
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-700 text-white"><ArrowUpRight className="motion-arrow size-5" data-direction="up-right" aria-hidden /></span>
          </div>
        </Link>
        {count > 1 && (
            <div className="absolute right-3 top-3 flex gap-1.5 sm:right-5 sm:top-5">
              <Button type="button" variant="secondary" size="icon" aria-label="Previous court" className="motion-trigger rounded-full bg-white/95 text-ink shadow-sm hover:bg-white" onClick={() => move(-1)}>
                <ChevronLeft className="motion-arrow size-4" data-direction="left" aria-hidden />
              </Button>
              <Button type="button" variant="secondary" size="icon" aria-label="Next court" className="motion-trigger rounded-full bg-white/95 text-ink shadow-sm hover:bg-white" onClick={() => move(1)}>
                <ChevronRight className="motion-arrow size-4" data-direction="right" aria-hidden />
              </Button>
            </div>
        )}
      </div>
      {count > 1 && (
        <div role="group" aria-label="Choose a court" className="mt-2 flex flex-wrap justify-center">
          {courts.map((court, index) => (
            <button
              key={court.slug}
              type="button"
              aria-label={`Show ${court.name}`}
              aria-current={index === currentIndex ? "true" : undefined}
              className="grid size-11 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
              onClick={() => select(index + 1)}
            >
              <span aria-hidden className={cn("h-1.5 rounded-full transition-colors", index === currentIndex ? "w-5 bg-brand-700" : "w-1.5 bg-brand-300")} />
            </button>
          ))}
        </div>
      )}
      <p className="sr-only" aria-live={suspended ? "polite" : "off"} aria-atomic="true">Court {currentIndex + 1} of {count}: {current.name}, {current.city}</p>
    </section>
  );
}
