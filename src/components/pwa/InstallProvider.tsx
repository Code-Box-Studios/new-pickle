"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const InstallContext = createContext<{ installed: boolean; prompt: InstallPrompt | null; install(): Promise<void> }>({ installed: false, prompt: null, install: async () => {} });

function standalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function subscribe(change: () => void) {
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", change);
  return () => media.removeEventListener("change", change);
}

export function InstallProvider({ children }: { children: React.ReactNode }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const inApp = useSyncExternalStore(subscribe, standalone, () => false);

  useEffect(() => {
    const offered = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const completed = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", offered);
    window.addEventListener("appinstalled", completed);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => console.error("[pwa] Service worker registration failed"));
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", offered);
      window.removeEventListener("appinstalled", completed);
    };
  }, []);

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    setPrompt(null);
    if (choice.outcome === "accepted") setInstalled(true);
  }

  return <InstallContext.Provider value={{ installed: installed || inApp, prompt, install }}>{children}</InstallContext.Provider>;
}

export function useInstallApp() { return useContext(InstallContext); }
