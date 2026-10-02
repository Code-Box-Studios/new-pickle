"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";

/** Home always reveals the hero, including repeated clicks on the active route. */
export function NavigationLink({
  href,
  ...props
}: Omit<ComponentProps<typeof NextLink>, "onNavigate">) {
  const home = href === "/" || href === "/#top";
  return (
    <NextLink
      {...props}
      href={home ? "/#top" : href}
      onNavigate={home ? (event) => {
        // Next handles route/hash changes; an identical URL has no scroll intent.
        if (window.location.pathname === "/" && !window.location.search && window.location.hash === "#top") {
          event.preventDefault();
          window.scrollTo({
            top: 0,
            left: 0,
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
          });
          document.getElementById("main-content")?.focus({ preventScroll: true });
        }
      } : undefined}
    />
  );
}
