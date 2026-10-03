"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

/** Scrub the rally through the entire viewport; scrolling back reverses it. */
export function RallyScene({ className }: { className?: string }) {
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    const update = () => {
      frame = 0;
      if (reducedMotion.matches) {
        delete scene.dataset.scrollMotion;
        return;
      }
      const rect = scene.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1,
        (window.innerHeight - rect.top) / (window.innerHeight + rect.height),
      ));
      scene.style.setProperty("--rally-progress", String(progress));
      scene.dataset.scrollMotion = "true";
    };

    // Scroll events only schedule one paint; React doesn't rerender per frame.
    const schedule = () => {
      if (reducedMotion.matches) {
        delete scene.dataset.scrollMotion;
        return;
      }
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(scene);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reducedMotion.addEventListener("change", schedule);
    update();

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reducedMotion.removeEventListener("change", schedule);
      delete scene.dataset.scrollMotion;
      scene.style.removeProperty("--rally-progress");
    };
  }, []);

  return (
    <div ref={sceneRef} className={cn("rally-scene", className)} aria-hidden="true">
      <svg viewBox="0 0 560 280" fill="none" className="size-full">
        <rect x="50" y="12" width="460" height="256" rx="28" fill="#e3fcf7" />
        <rect x="77" y="30" width="406" height="220" rx="12" fill="#00684a" />
        <rect x="213" y="47" width="134" height="186" fill="#00513b" />
        <g stroke="#e3fcf7" strokeWidth="2.5">
          <rect x="94" y="47" width="372" height="186" />
          <path d="M213 47v186M347 47v186M94 140h119M347 140h119" />
          <path d="M280 38v204" strokeWidth="3" />
          <path d="M274 47v186M286 47v186" strokeOpacity=".3" strokeWidth="1" strokeDasharray="3 4" />
        </g>
        <circle cx="280" cy="38" r="4" fill="#e3fcf7" />
        <circle cx="280" cy="242" r="4" fill="#e3fcf7" />
        <path d="M162 90Q280 15 398 185" className="rally-trail" stroke="#b9f5d0" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 8" />
        <g className="rally-paddle rally-paddle-left">
          <g transform="translate(137 60) rotate(-25 25 35)">
            <rect x="3" y="2" width="44" height="58" rx="17" fill="#001e2b" />
            <rect x="8" y="7" width="34" height="46" rx="13" stroke="#71e8ab" strokeWidth="1.5" />
            <path d="M19 58h12v22a6 6 0 0 1-12 0z" fill="#001e2b" />
            <path d="M20 68h10M20 73h10M20 78h10" stroke="#71e8ab" strokeWidth="1.5" />
          </g>
        </g>
        <g className="rally-paddle rally-paddle-right">
          <g transform="translate(377 155) rotate(155 25 35)">
            <rect x="3" y="2" width="44" height="58" rx="17" fill="#b9f5d0" />
            <rect x="8" y="7" width="34" height="46" rx="13" stroke="#00684a" strokeWidth="1.5" />
            <path d="M19 58h12v22a6 6 0 0 1-12 0z" fill="#b9f5d0" />
            <path d="M20 68h10M20 73h10M20 78h10" stroke="#00684a" strokeWidth="1.5" />
          </g>
        </g>
        <g className="rally-ball">
          <ellipse cx="285" cy="109" rx="13" ry="5" fill="#001e2b" fillOpacity=".25" />
          <circle cx="280" cy="94" r="13" fill="#00ed64" stroke="#001e2b" strokeWidth="1.5" />
          <g fill="#00513b">
            <circle cx="275" cy="90" r="2" />
            <circle cx="285" cy="90" r="2" />
            <circle cx="280" cy="98" r="2" />
          </g>
        </g>
        <g stroke="#00684a" strokeOpacity=".25" strokeWidth="1.5">
          <path d="M21 62v14M14 69h14M532 210v14M525 217h14" />
          <circle cx="526" cy="65" r="4" />
          <circle cx="31" cy="215" r="3" />
        </g>
      </svg>
    </div>
  );
}
