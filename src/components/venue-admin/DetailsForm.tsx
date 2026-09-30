"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { AMENITY_LABELS } from "@/lib/amenities";
import { cn } from "@/lib/cn";
import { cityNames, barangaysForCity, OTHER } from "@/lib/location/ph-locations";
import { sendJson } from "./api";

interface Initial {
  name: string;
  description: string | null;
  addressLine: string | null;
  barangay: string | null;
  city: string;
  contactNumber: string | null;
  website: string | null;
  mapUrl: string | null;
  houseRules: string | null;
  amenities: string[];
}

export function DetailsForm({
  venueId,
  initial,
  locked,
}: {
  venueId: string;
  initial: Initial;
  locked: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState(initial);
  const [amenities, setAmenities] = useState<Set<string>>(new Set(initial.amenities));
  const [busy, setBusy] = useState(false);

  function set<K extends keyof Initial>(k: K, v: Initial[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  const [cityChoice, setCityChoice] = useState(
    cityNames().includes(initial.city) ? initial.city : OTHER,
  );
  const [brgyChoice, setBrgyChoice] = useState<string>(() => {
    if (!initial.barangay) return "";
    return barangaysForCity(initial.city).includes(initial.barangay) ? initial.barangay : OTHER;
  });

  function onCityChange(value: string) {
    setCityChoice(value);
    set("city", value === OTHER ? "" : value); // never store the "Other" sentinel
    setBrgyChoice("");                          // city changed → reset barangay
    set("barangay", null);
  }

  function onBarangayChange(value: string) {
    setBrgyChoice(value);
    if (value === OTHER) set("barangay", "");   // reveal text box for free entry
    else set("barangay", value || null);        // "" placeholder → null
  }

  function toggle(a: string) {
    setAmenities((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      return next;
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await sendJson(`/api/owner/venues/${venueId}`, "PATCH", {
        name: f.name,
        description: f.description,
        addressLine: f.addressLine,
        barangay: f.barangay,
        city: f.city,
        contactNumber: f.contactNumber,
        website: f.website,
        mapUrl: f.mapUrl,
        houseRules: f.houseRules,
        amenities: [...amenities],
      });
      router.push(`/owner/venues/${venueId}/photos`);
      router.refresh();
    } catch (err) {
      toast({ title: "Couldn't save", description: (err as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <fieldset disabled={locked} className="space-y-5">
        <Field label="Venue name" htmlFor="name">
          <Input id="name" required value={f.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Description" htmlFor="desc">
          <textarea
            id="desc"
            rows={3}
            className="w-full rounded-xl border border-line bg-surface p-4 text-base leading-relaxed text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60"
            value={f.description ?? ""}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>
        <div className="grid gap-5 border-t border-line pt-5 sm:grid-cols-2">
          <Field label="Address" htmlFor="addr">
            <Input id="addr" value={f.addressLine ?? ""} onChange={(e) => set("addressLine", e.target.value)} />
          </Field>
          <Field label="City" htmlFor="city">
            <Select id="city" value={cityChoice} onChange={(e) => onCityChange(e.target.value)}>
              {cityNames().map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value={OTHER}>Other…</option>
            </Select>
            {cityChoice === OTHER && (
              <Input
                className="mt-2"
                aria-label="City name"
                required
                placeholder="City"
                value={f.city}
                onChange={(e) => set("city", e.target.value)}
              />
            )}
          </Field>
          <Field label="Barangay" htmlFor="brgy">
            <Select id="brgy" value={brgyChoice} onChange={(e) => onBarangayChange(e.target.value)}>
              <option value="">Select barangay…</option>
              {barangaysForCity(f.city).map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
              <option value={OTHER}>Other…</option>
            </Select>
            {brgyChoice === OTHER && (
              <Input
                className="mt-2"
                aria-label="Barangay name"
                placeholder="Barangay"
                value={f.barangay ?? ""}
                onChange={(e) => set("barangay", e.target.value)}
              />
            )}
          </Field>
          <Field label="Contact number" htmlFor="tel">
            <Input id="tel" inputMode="tel" value={f.contactNumber ?? ""} onChange={(e) => set("contactNumber", e.target.value)} />
          </Field>
        </div>
        <Field label="Website (optional)" htmlFor="web">
          <Input id="web" value={f.website ?? ""} onChange={(e) => set("website", e.target.value)} />
        </Field>
        <Field label="Google Maps link (optional)" htmlFor="mapUrl" hint="Paste your venue's Google Maps share link.">
          <Input
            id="mapUrl"
            inputMode="url"
            placeholder="https://maps.app.goo.gl/…"
            value={f.mapUrl ?? ""}
            onChange={(e) => set("mapUrl", e.target.value)}
          />
        </Field>

        <div>
          <span className="mb-2 block text-sm font-medium text-ink-soft">Amenities</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(AMENITY_LABELS).map(([key, label]) => {
              const on = amenities.has(key);
              return (
                <button
                  type="button"
                  key={key}
                  aria-pressed={on}
                  onClick={() => toggle(key)}
                  className={cn(
                    "flex min-h-12 items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                    on ? "border-brand-600/50 bg-mist text-brand-800" : "border-line bg-surface text-ink-soft hover:bg-canvas",
                  )}
                >
                  {label}
                  {on && <Check className="ml-auto size-4 shrink-0" aria-hidden />}
                </button>
              );
            })}
          </div>
        </div>

        <Field label="House rules" htmlFor="rules">
          <textarea
            id="rules"
            rows={3}
            className="w-full rounded-xl border border-line bg-surface p-4 text-base leading-relaxed text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60"
            value={f.houseRules ?? ""}
            onChange={(e) => set("houseRules", e.target.value)}
          />
        </Field>
      </fieldset>

      {!locked && (
        <Button type="submit" size="lg" block loading={busy}>
          Save &amp; continue
        </Button>
      )}
    </form>
  );
}
