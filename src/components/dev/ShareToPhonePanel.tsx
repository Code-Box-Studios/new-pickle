"use client";

import { useState } from "react";
import { Smartphone, X, Copy } from "lucide-react";

interface Candidate {
  iface: string;
  address: string;
  url: string;
  qrDataUrl: string;
}

interface ShareInfo {
  url: string | null;
  qrDataUrl: string | null;
  candidates: Candidate[];
  error?: string;
}

/** Dev-only: reveal a QR of the machine's LAN URL so a phone can scan it. */
export function ShareToPhonePanel() {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<ShareInfo | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (process.env.NODE_ENV === "production" || dismissed) return null;

  function fail() {
    setInfo({
      url: null,
      qrDataUrl: null,
      candidates: [],
      error: "Couldn't reach the dev share endpoint — is the server running?",
    });
    setSelected(null);
    setOpen(true);
  }

  async function share() {
    try {
      const res = await fetch("/api/dev/share-url");
      if (!res.ok) {
        fail();
        return;
      }
      const data = (await res.json()) as ShareInfo;
      setInfo(data);
      setSelected(data.candidates[0]?.address ?? null);
      setOpen(true);
    } catch {
      fail();
    }
  }

  if (!open) {
    // Mobile/tablet: icon-only FAB sitting just above the bottom tab bar on the
    // left, with a low z-index so the full-width Continue summary (z-30) covers
    // it while a slot is selected — it never hides the Continue button, the nav,
    // or the summary text. md+ (no bottom nav): labeled pill, bottom-right.
    return (
      <div className="fixed bottom-16 left-3 z-20 flex items-center gap-1 md:bottom-3 md:left-auto md:right-3 md:z-[80]">
        <button
          type="button"
          onClick={share}
          aria-label="Share to phone"
          className="flex items-center gap-1.5 rounded-full bg-ink p-2.5 text-xs font-semibold text-white shadow-lg hover:bg-ink/90 md:px-3 md:py-2"
        >
          <Smartphone className="size-4" aria-hidden />
          <span className="hidden md:inline">Share to phone</span>
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Hide"
          title="Hide until reload"
          className="rounded-full bg-ink/80 p-1.5 text-white shadow-lg hover:bg-ink"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>
    );
  }

  const current =
    info?.candidates.find((c) => c.address === selected) ?? null;

  return (
    <div className="fixed bottom-16 right-3 z-[90] w-64 rounded-xl border border-black/10 bg-white p-3 text-center shadow-xl md:bottom-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-ink">
          Scan to open on your phone
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="rounded p-0.5 hover:bg-black/5"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      {info?.error || !current ? (
        <div className="py-6">
          <p className="text-xs text-ink/60">
            {info?.error ??
              "You don't appear to be on a Wi-Fi/LAN network."}
          </p>
          <button
            type="button"
            onClick={share}
            className="mt-3 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink/90"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- data-URL QR, not an optimizable remote image */}
          <img
            src={current.qrDataUrl}
            alt="QR code for the LAN URL"
            className="mx-auto size-40"
          />
          {info!.candidates.length > 1 && (
            <select
              value={selected ?? ""}
              onChange={(e) => setSelected(e.target.value)}
              className="mt-2 w-full rounded border border-black/10 px-1.5 py-1 text-xs"
            >
              {info!.candidates.map((c) => (
                <option key={c.address} value={c.address}>
                  {c.iface} — {c.address}
                </option>
              ))}
            </select>
          )}
          <div className="mt-2 flex items-center justify-center gap-1.5">
            <span className="truncate text-xs text-ink/70">{current.url}</span>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(current.url)}
              aria-label="Copy URL"
              className="rounded p-0.5 hover:bg-black/5"
            >
              <Copy className="size-3.5" aria-hidden />
            </button>
          </div>
          <p className="mt-2 text-[10px] leading-tight text-ink/50">
            Phone must be on the same Wi-Fi. First time on Windows, allow Node
            through the firewall (Private networks).
          </p>
        </>
      )}
    </div>
  );
}
