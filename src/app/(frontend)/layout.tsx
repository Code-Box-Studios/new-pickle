import type { Metadata, Viewport } from "next";
import "../globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { MagicLinkBanner } from "@/components/dev/MagicLinkBanner";
import { ShareToPhonePanel } from "@/components/dev/ShareToPhonePanel";
import { InstallProvider } from "@/components/pwa/InstallProvider";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: {
    default: "RallyPoint — Find your next game",
    template: "%s · RallyPoint",
  },
  description:
    "Discover and reserve pickleball courts across independent venues in Davao. Search, compare, book, and play.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/brand/rallypoint-mark.svg", apple: "/brand/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "RallyPoint", statusBarStyle: "default" },
  openGraph: {
    type: "website",
    siteName: "RallyPoint",
    title: "RallyPoint — Find your next game",
    description:
      "Discover and reserve pickleball courts across independent venues in Davao.",
  },
};

export const viewport: Viewport = { themeColor: "#001e2b", width: "device-width", initialScale: 1 };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="font-sans text-ink antialiased">
        <InstallProvider>
          <MagicLinkBanner />
          <ToastProvider>{children}</ToastProvider>
          <ShareToPhonePanel />
        </InstallProvider>
      </body>
    </html>
  );
}
