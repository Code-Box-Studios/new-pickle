import type { ComponentProps } from "react";

/** Demo seed URLs are placeholders; real venue media is rendered unchanged. */
export function VenueImage({ src, alt, ...props }: ComponentProps<"img">) {
  const demo =
    typeof src === "string" && src.startsWith("https://picsum.photos/");
  return (
    // eslint-disable-next-line @next/next/no-img-element -- venue uploads may use external storage URLs
    <img
      {...props}
      src={demo ? "/images/demo-court.svg" : src}
      alt={demo ? `${alt ?? "Court"} — court illustration` : alt}
    />
  );
}
