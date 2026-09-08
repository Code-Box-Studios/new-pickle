import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { MagicLinkBanner } from "@/components/dev/MagicLinkBanner";
import { ShareToPhonePanel } from "@/components/dev/ShareToPhonePanel";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: {
    default: "RallyPoint — Find your next game",
    template: "%s · RallyPoint",
  },
  description:
    "Discover and reserve pickleball courts across independent venues in Davao. Search, compare, book, and play.",
  openGraph: {
    type: "website",
    siteName: "RallyPoint",
    title: "RallyPoint — Find your next game",
    description:
      "Discover and reserve pickleball courts across independent venues in Davao.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-white text-ink antialiased">
        <ToastProvider>{children}</ToastProvider>
        <MagicLinkBanner />
        <ShareToPhonePanel />
      </body>
    </html>
  );
}
