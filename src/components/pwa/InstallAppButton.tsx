"use client";

import { useState } from "react";
import { Download, Share, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BrandMark } from "@/components/ui/brand";
import { useInstallApp } from "./InstallProvider";

export function InstallAppButton() {
  const { installed, prompt, install } = useInstallApp();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  if (installed) return null;

  async function activate() {
    if (!prompt) { setOpen(true); return; }
    setLoading(true);
    try { await install(); } catch { setOpen(true); } finally { setLoading(false); }
  }

  return (
    <>
      <Button type="button" variant="outlineOnDark" size="sm" className="mt-6 gap-2" loading={loading} onClick={activate}><Download className="size-4" aria-hidden />Install Pikol</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <BrandMark className="mb-3 size-14" />
            <DialogTitle className="text-2xl">Your next game, one tap away.</DialogTitle>
            <DialogDescription>Add Pikol to your home screen. It opens like an app, with live court availability.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="rounded-xl border border-border bg-muted p-4">
              <p className="mb-2 flex items-center gap-2 font-semibold text-ink"><Share className="size-4 text-brand-700" aria-hidden />iPhone & iPad</p>
              <p className="leading-relaxed text-muted-foreground">Open this website in Safari, tap Share, then Add to Home Screen. Keep Open as Web App enabled if shown, then tap Add.</p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="mb-2 flex items-center gap-2 font-semibold text-ink"><Smartphone className="size-4 text-brand-700" aria-hidden />Android & desktop</p>
              <p className="leading-relaxed text-muted-foreground">Open your browser menu and choose Install app or Add to Home screen. If installation is unavailable, try Chrome or Edge.</p>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">An internet connection is needed to search, book, and manage reservations.</p>
          </div>
          <Button type="button" onClick={() => setOpen(false)}>Got it</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
