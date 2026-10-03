"use client";

import { useState, type ElementType, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Armchair,
  ArrowRight,
  Building2,
  Car,
  Check,
  CircleAlert,
  DoorOpen,
  Droplets,
  Lightbulb,
  MapPin,
  Save,
  ShieldCheck,
  ShowerHead,
  Snowflake,
  Sparkles,
  Sun,
  Umbrella,
} from "lucide-react";
import { CityPicker } from "@/components/search/CityPicker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Field } from "@/components/ui/input";
import {
  CourtPattern,
  PaddleIcon,
  PickleballIcon,
} from "@/components/ui/pickleball";
import { SelectField, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { VenueImage } from "@/components/venue/VenueImage";
import { AMENITY_LABELS } from "@/lib/amenities";
import { PHILIPPINE_CITIES } from "@/lib/cities";
import { cn } from "@/lib/cn";
import { barangaysForCity, OTHER } from "@/lib/location/ph-locations";
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

const CITIES = [
  ...PHILIPPINE_CITIES,
  { value: OTHER, name: "Other city or municipality" },
];
const AMENITY_ICONS: Record<string, ElementType> = {
  indoor: Building2,
  outdoor: Sun,
  covered: Umbrella,
  lights: Lightbulb,
  parking: Car,
  restroom: DoorOpen,
  shower: ShowerHead,
  paddle_rental: PaddleIcon,
  ball_rental: PickleballIcon,
  lounge: Armchair,
  water: Droplets,
  aircon: Snowflake,
};

function Section({
  number,
  title,
  description,
  icon: Icon,
  children,
}: {
  number: string;
  title: string;
  description: string;
  icon: ElementType;
  children: React.ReactNode;
}) {
  return (
    <Card className="min-w-0 overflow-hidden border-line bg-white">
      <div className="flex items-start gap-3 border-b border-line/70 px-5 py-5 sm:px-6">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-mist text-brand-700">
          <Icon className="size-[18px]" aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-ink">
            <span className="mr-2 text-xs font-normal text-muted-foreground">
              {number}
            </span>
            {title}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      <div className="space-y-5 p-5 sm:p-6">{children}</div>
    </Card>
  );
}

export function DetailsForm({
  venueId,
  initial,
  locked,
  coverPhoto,
}: {
  venueId: string;
  initial: Initial;
  locked: boolean;
  coverPhoto?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState(initial);
  const [amenities, setAmenities] = useState<Set<string>>(
    new Set(initial.amenities),
  );
  const [saving, setSaving] = useState<"draft" | "continue" | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cityChoice, setCityChoice] = useState(
    PHILIPPINE_CITIES.some((city) => city.value === initial.city)
      ? initial.city
      : OTHER,
  );
  const [brgyChoice, setBrgyChoice] = useState<string>(() => {
    if (!initial.barangay) return "";
    return barangaysForCity(initial.city).includes(initial.barangay)
      ? initial.barangay
      : OTHER;
  });
  const barangays = barangaysForCity(f.city);

  function set<K extends keyof Initial>(key: K, value: Initial[K]) {
    setF((previous) => ({ ...previous, [key]: value }));
    setSaved(false);
  }
  function onCityChange(value: string) {
    setCityChoice(value);
    setF((previous) => ({
      ...previous,
      city: value === OTHER ? "" : value,
      barangay: null,
    }));
    setBrgyChoice("");
    setSaved(false);
  }
  function onBarangayChange(value: string) {
    setBrgyChoice(value);
    set("barangay", value === OTHER ? "" : value || null);
  }
  function toggle(key: string) {
    setAmenities((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setSaved(false);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked || saving) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const intent =
      submitter?.getAttribute("value") === "draft" ? "draft" : "continue";
    setSaving(intent);
    setError(null);
    try {
      await sendJson(`/api/owner/venues/${venueId}`, "PATCH", {
        ...f,
        amenities: [...amenities],
      });
      setSaved(true);
      if (intent === "continue") router.push(`/owner/venues/${venueId}/photos`);
      else toast({ title: "Draft saved", tone: "success" });
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Please try again.";
      setError(message);
      toast({ title: "Couldn't save", description: message, tone: "error" });
    } finally {
      setSaving(null);
    }
  }

  return (
    <form
      onSubmit={save}
      aria-label="Venue details"
      className="relative space-y-5"
    >
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <fieldset disabled={locked || !!saving} className="min-w-0 space-y-5">
          <legend className="sr-only">Venue details</legend>
          <Section
            number="01"
            title="The essentials"
            description="A name players will remember. A story they'll connect with."
            icon={Building2}
          >
            <Field label="Venue name" htmlFor="name">
              <Input
                id="name"
                required
                placeholder="e.g. Pikol Park"
                autoComplete="organization"
                value={f.name}
                onChange={(event) => set("name", event.target.value)}
              />
            </Field>
            <Field
              label="Description"
              htmlFor="desc"
              hint="Share what makes your venue special: the atmosphere, the courts, or the community."
            >
              <Textarea
                id="desc"
                rows={4}
                placeholder="Tell players a little about your place…"
                className="min-h-32 px-4 py-3 leading-relaxed"
                value={f.description ?? ""}
                onChange={(event) => set("description", event.target.value)}
              />
            </Field>
          </Section>

          <Section
            number="02"
            title="Where the game happens"
            description="Help players arrive at the right place, ready to play."
            icon={MapPin}
          >
            <Field label="Address" htmlFor="addr">
              <Input
                id="addr"
                placeholder="Building, street, or landmark"
                autoComplete="street-address"
                value={f.addressLine ?? ""}
                onChange={(event) => set("addressLine", event.target.value)}
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="City" htmlFor="city">
                <CityPicker
                  id="city"
                  cities={CITIES}
                  value={cityChoice}
                  onValueChange={onCityChange}
                />
                {cityChoice === OTHER && (
                  <Input
                    className="mt-1"
                    aria-label="City or municipality name"
                    required
                    placeholder="Enter your city or municipality"
                    value={f.city}
                    onChange={(event) => set("city", event.target.value)}
                  />
                )}
              </Field>
              <Field label="Barangay" htmlFor="brgy">
                {barangays.length > 0 ? (
                  <>
                    <SelectField
                      id="brgy"
                      placeholder="Select barangay"
                      value={brgyChoice}
                      onValueChange={onBarangayChange}
                    >
                      {barangays.map((barangay) => (
                        <SelectItem key={barangay} value={barangay}>
                          {barangay}
                        </SelectItem>
                      ))}
                      <SelectItem value={OTHER}>Other barangay</SelectItem>
                    </SelectField>
                    {brgyChoice === OTHER && (
                      <Input
                        className="mt-1"
                        aria-label="Barangay name"
                        placeholder="Enter barangay"
                        value={f.barangay ?? ""}
                        onChange={(event) =>
                          set("barangay", event.target.value || null)
                        }
                      />
                    )}
                  </>
                ) : (
                  <Input
                    id="brgy"
                    placeholder="Enter barangay"
                    autoComplete="address-level3"
                    value={f.barangay ?? ""}
                    onChange={(event) =>
                      set("barangay", event.target.value || null)
                    }
                  />
                )}
              </Field>
            </div>
            <Field
              label="Google Maps link (optional)"
              htmlFor="mapUrl"
              hint="Paste a share link so players can get directions."
            >
              <Input
                id="mapUrl"
                inputMode="url"
                placeholder="https://maps.app.goo.gl/…"
                value={f.mapUrl ?? ""}
                onChange={(event) => set("mapUrl", event.target.value)}
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Contact number" htmlFor="tel">
                <Input
                  id="tel"
                  type="tel"
                  autoComplete="tel"
                  placeholder="09XX XXX XXXX"
                  value={f.contactNumber ?? ""}
                  onChange={(event) => set("contactNumber", event.target.value)}
                />
              </Field>
              <Field label="Website (optional)" htmlFor="web">
                <Input
                  id="web"
                  inputMode="url"
                  placeholder="https://your-venue.com"
                  value={f.website ?? ""}
                  onChange={(event) => set("website", event.target.value)}
                />
              </Field>
            </div>
          </Section>

          <Section
            number="03"
            title="The little extras"
            description="Select the amenities players can enjoy at your venue."
            icon={Sparkles}
          >
            <div
              className="grid grid-cols-2 gap-2 sm:grid-cols-3"
              role="group"
              aria-label="Amenities"
            >
              {Object.entries(AMENITY_LABELS).map(([key, label]) => {
                const on = amenities.has(key);
                const Icon = AMENITY_ICONS[key] ?? Check;
                return (
                  <Button
                    key={key}
                    type="button"
                    variant="ghost"
                    aria-pressed={on}
                    onClick={() => toggle(key)}
                    className={cn(
                      "h-auto min-h-11 min-w-0 justify-start gap-2 border px-3 py-2.5 text-xs font-medium sm:text-sm",
                      on
                        ? "border-brand-700/30 bg-mist text-brand-800"
                        : "border-line bg-white text-ink-soft",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className="min-w-0 whitespace-normal text-left leading-tight">
                      {label}
                    </span>
                    {on && (
                      <Check className="ml-auto size-3 shrink-0" aria-hidden />
                    )}
                  </Button>
                );
              })}
            </div>
          </Section>

          <Section
            number="04"
            title="Good games start here"
            description="Set expectations for a great experience at your venue."
            icon={ShieldCheck}
          >
            <Field
              label="House rules"
              htmlFor="rules"
              hint="For example: footwear, equipment rentals, arrival times, and food or drinks."
            >
              <Textarea
                id="rules"
                rows={4}
                className="min-h-32 px-4 py-3 leading-relaxed"
                placeholder="What should players know before they arrive?"
                value={f.houseRules ?? ""}
                onChange={(event) => set("houseRules", event.target.value)}
              />
            </Field>
          </Section>
        </fieldset>

        <aside
          className="hidden min-w-0 space-y-4 xl:sticky xl:top-6 xl:block"
          aria-label="Listing preview"
        >
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Listing preview
            </p>
            <span className="text-[10px] text-muted-foreground">
              Updates as you type
            </span>
          </div>
          <Card className="overflow-hidden border-line bg-white">
            {coverPhoto ? (
              <VenueImage
                src={coverPhoto}
                alt="Venue cover"
                className="aspect-[4/3] w-full object-cover"
              />
            ) : (
              <div className="relative grid aspect-[4/3] place-items-center overflow-hidden bg-brand-950 text-brand-200">
                <CourtPattern className="absolute w-[125%] -rotate-12 opacity-15" />
                <div className="relative flex flex-col items-center gap-3">
                  <span className="grid size-14 place-items-center rounded-full border border-white/15 bg-white/5">
                    <PaddleIcon className="size-7 text-brand-500" />
                  </span>
                  <p className="text-xs text-white/65">
                    Your cover photo goes here
                  </p>
                </div>
              </div>
            )}
            <div className="space-y-3 p-5">
              <h3 className="break-words text-xl font-semibold tracking-tight text-ink">
                {f.name.trim() || "Your venue name"}
              </h3>
              <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>
                  {[f.barangay, f.city].filter(Boolean).join(", ") ||
                    "Your location"}
                </span>
              </p>
              <p className="line-clamp-4 break-words text-sm leading-relaxed text-ink-soft">
                {f.description?.trim() ||
                  "A little about your venue will appear here."}
              </p>
              {amenities.size > 0 && (
                <div className="flex flex-wrap gap-1.5 border-t border-line pt-3">
                  {[...amenities].slice(0, 5).map((key) => (
                    <span
                      key={key}
                      className="rounded-full bg-canvas px-2.5 py-1 text-[10px] text-ink-soft"
                    >
                      {AMENITY_LABELS[key] ?? key}
                    </span>
                  ))}
                  {amenities.size > 5 && (
                    <span className="px-1 py-1 text-[10px] text-muted-foreground">
                      +{amenities.size - 5} more
                    </span>
                  )}
                </div>
              )}
            </div>
          </Card>
          <Card className="border-brand-200/60 bg-mist/50 p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-brand-800">
              <Lightbulb className="size-4" aria-hidden /> A little detail goes
              a long way
            </p>
            <p className="mt-2 text-xs leading-relaxed text-ink-soft">
              Mention who your venue is for, what makes it welcoming, and any
              landmarks that help players find it.
            </p>
          </Card>
        </aside>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error} Your edits are still here.</span>
        </div>
      )}
      {!locked && (
        <Card className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom)+0.5rem)] z-20 flex flex-col gap-3 border-line bg-white/95 p-3 shadow-card backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:p-4 lg:bottom-4">
          <div
            role="status"
            className="flex items-center gap-2 px-1 text-xs text-muted-foreground sm:text-sm"
          >
            {saved ? (
              <>
                <Check className="size-4 text-brand-700" aria-hidden /> All
                changes saved
              </>
            ) : (
              <>
                <Save className="size-4" aria-hidden />
                <span>Save your progress, then add photos.</span>
              </>
            )}
          </div>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 sm:flex">
            <Button
              type="submit"
              name="intent"
              value="draft"
              variant="outline"
              loading={saving === "draft"}
              disabled={!!saving}
              className="px-3 sm:px-5"
            >
              Save draft
            </Button>
            <Button
              type="submit"
              name="intent"
              value="continue"
              loading={saving === "continue"}
              disabled={!!saving}
              className="px-3 sm:px-5"
            >
              Save &amp; continue{" "}
              <ArrowRight className="hidden size-4 sm:block" aria-hidden />
            </Button>
          </div>
        </Card>
      )}
    </form>
  );
}
