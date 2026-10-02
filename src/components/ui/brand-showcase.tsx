"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/ui/brand";
import { PaddleIcon } from "@/components/ui/pickleball";

/** Decorative platform branding, independent of venue listings. */
export function BrandShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let inViewport = true;
    const updateVisibility = () => setVisible(inViewport && !document.hidden);
    const observer = new IntersectionObserver(
      ([entry]) => {
        inViewport = entry.isIntersecting;
        updateVisibility();
      },
      { threshold: 0.05 },
    );
    if (containerRef.current) observer.observe(containerRef.current);
    document.addEventListener("visibilitychange", updateVisibility);
    updateVisibility();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const logo = container.querySelector<SVGSVGElement>(
      ".brand-showcase-mark svg",
    );
    const ball = logo?.querySelector<SVGCircleElement>(".brand-ball > circle");
    const left = container.querySelector<SVGGElement>(
      ".brand-showcase-paddle:not(.brand-showcase-paddle-right) svg g",
    );
    const right = container.querySelector<SVGGElement>(
      ".brand-showcase-paddle-right svg g",
    );
    if (!logo || !ball || !left || !right) return;

    // Express each paddle's contact point in the logo's SVG coordinates so the
    // original white ball can leave its logo and return exactly, at every size.
    const updateTrajectory = () => {
      const logoMatrix = logo.getScreenCTM();
      const leftMatrix = left.getScreenCTM();
      const rightMatrix = right.getScreenCTM();
      if (!logoMatrix || !leftMatrix || !rightMatrix) return;
      const inverse = logoMatrix.inverse();
      const contacts = [leftMatrix, rightMatrix].map((matrix) => {
        const point = new DOMPoint(12, 9)
          .matrixTransform(matrix)
          .matrixTransform(inverse);
        return {
          x: point.x - ball.cx.baseVal.value,
          y: point.y - ball.cy.baseVal.value,
        };
      });
      for (const [index, side] of ["left", "right"].entries()) {
        container.style.setProperty(
          `--rally-${side}-x`,
          `${contacts[index].x.toFixed(3)}px`,
        );
        container.style.setProperty(
          `--rally-${side}-y`,
          `${contacts[index].y.toFixed(3)}px`,
        );
      }
      container.style.setProperty(
        "--rally-mid-x",
        `${((contacts[0].x + contacts[1].x) / 2).toFixed(3)}px`,
      );
      container.style.setProperty(
        "--rally-mid-y",
        `${(Math.min(contacts[0].y, contacts[1].y) - 12).toFixed(3)}px`,
      );
      container.dataset.rallyReady = "true";
    };
    const observer = new ResizeObserver(updateTrajectory);
    observer.observe(container);
    observer.observe(logo);
    updateTrajectory();
    return () => {
      observer.disconnect();
      delete container.dataset.rallyReady;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      data-motion={paused || !visible ? "paused" : "playing"}
      className="brand-showcase relative isolate mx-auto aspect-[5/4] w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025] sm:aspect-[3/2] lg:aspect-[5/4]"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="brand-showcase-glow absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,237,100,0.12),transparent_65%)]" />
        <svg
          viewBox="0 0 500 400"
          fill="none"
          className="absolute inset-0 size-full text-brand-300"
        >
          <g className="brand-showcase-orbit">
            <circle
              cx="250"
              cy="180"
              r="100"
              stroke="currentColor"
              strokeOpacity=".12"
            />
            <circle
              cx="250"
              cy="180"
              r="155"
              stroke="currentColor"
              strokeOpacity=".12"
              strokeDasharray="2 10"
            />
            <ellipse
              cx="250"
              cy="180"
              rx="220"
              ry="126"
              transform="rotate(-28 250 180)"
              stroke="currentColor"
              strokeOpacity=".13"
            />
          </g>
          <path
            className="brand-showcase-trail"
            d="M420 120C350 35 190 60 85 240C155 350 370 325 420 120Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeOpacity=".22"
            strokeDasharray="3 9"
          />
        </svg>
        <div className="brand-showcase-paddle absolute left-[4%] top-[45%] text-brand-300/60 sm:left-[8%]">
          <PaddleIcon className="size-12 rotate-[-28deg] sm:size-20 lg:size-24" />
        </div>
        <div className="brand-showcase-paddle brand-showcase-paddle-right absolute right-[9%] top-[12%] text-brand-300/35">
          <PaddleIcon className="size-12 rotate-[145deg] sm:size-16 lg:size-20" />
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pb-2 sm:gap-4">
          <div className="brand-showcase-mark rounded-[30%] shadow-[0_24px_64px_-12px_rgba(0,0,0,0.35)]">
            <BrandMark className="size-20 overflow-visible sm:size-28 lg:size-32" />
          </div>
          <div className="brand-showcase-wordmark">
            <span className="brand-showcase-lettering">Pik</span>
            <svg
              viewBox="0 0 48 48"
              fill="none"
              className="brand-showcase-wordball"
              aria-label="o"
            >
              <circle cx="24" cy="24" r="19" fill="currentColor" />
              <g fill="#001e2b">
                <circle cx="17" cy="17" r="3.3" />
                <circle cx="32" cy="20" r="3.3" />
                <circle cx="22" cy="32" r="3.3" />
              </g>
            </svg>
            <span className="brand-showcase-lettering">l</span>
          </div>
          <svg
            viewBox="0 0 220 16"
            fill="none"
            className="-mt-1 h-3 w-32 text-brand-300/65 sm:w-40 lg:w-48"
          >
            <path
              d="M6 11C72 2 152 2 212 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              className="brand-showcase-swoosh"
              d="M6 11C72 2 152 2 212 6"
              stroke="#e3fcf7"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="28 190"
            />
          </svg>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setPaused((value) => !value)}
        aria-label={paused ? "Resume hero animation" : "Pause hero animation"}
        aria-pressed={paused}
        className="absolute right-3 top-3 size-11 border border-white/10 bg-white/5 text-white/60 motion-reduce:hidden"
      >
        {paused ? (
          <Play className="size-3.5" />
        ) : (
          <Pause className="size-3.5" />
        )}
      </Button>
    </div>
  );
}
