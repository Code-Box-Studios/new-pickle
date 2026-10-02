import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "RallyPoint — Find your next game",
    short_name: "RallyPoint",
    description: "Find, reserve, and play pickleball at courts near you.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#001e2b",
    theme_color: "#001e2b",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
