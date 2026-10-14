"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { CalendarCheck, MapPin, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { SelectField, SelectItem } from "@/components/ui/select";
import type {
  PlayerDashboardView,
  PlayerProfileView,
  PlayerSessionView,
  ResultTotals,
  SkillLevel,
} from "@/lib/players/types";
import {
  AttendanceBadge,
  PlayerBookingFacts,
  PlayerError,
  PlayerLoading,
  PlayerPrivacy,
  PlayerShell,
} from "./PlayerShared";
import { playerError, playerRequest, usePlayerResource } from "./player-client";

function ResultSummary({
  title,
  totals,
}: {
  title: string;
  totals: ResultTotals;
}) {
  return (
    <Card
      role="region"
      aria-label={title}
      className="space-y-4 rounded-xl bg-white p-5 sm:p-6"
    >
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Trophy className="size-4 text-brand-700" aria-hidden />
        {title}
      </h2>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ["Wins", totals.wins],
          ["Losses", totals.losses],
          ["Decided games", totals.matches],
          [
            "Win rate",
            totals.winRate === null
              ? "—"
              : `${Math.round(totals.winRate * 100)}%`,
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-ink-soft">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-brand-700">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {totals.winRate === null && (
        <p className="text-xs text-ink-soft">
          Win rate appears after your first decided game.
        </p>
      )}
    </Card>
  );
}

function ProfileForm({
  profile,
  onSaved,
}: {
  profile: PlayerProfileView;
  onSaved: () => Promise<void>;
}) {
  const id = useId();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [skillLevel, setSkillLevel] = useState<SkillLevel | "UNSET">(
    profile.skillLevel ?? "UNSET",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await playerRequest("/api/players/me", {
        method: "PATCH",
        body: {
          displayName: displayName.trim(),
          skillLevel: skillLevel === "UNSET" ? null : skillLevel,
        },
      });
      setSaved(true);
      await onSaved();
    } catch (cause) {
      setError(playerError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="space-y-5 rounded-xl bg-white p-5 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">Player profile</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Choose how your name appears in session rosters.
        </p>
      </div>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <Field label="Display name" htmlFor={`${id}-name`}>
          <Input
            id={`${id}-name`}
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.target.value);
              setSaved(false);
            }}
            required
            maxLength={60}
            disabled={busy}
            autoComplete="nickname"
          />
        </Field>
        <Field
          label="Skill level (optional)"
          htmlFor={`${id}-skill`}
          hint="Self-described only. This is not an official rating."
        >
          <SelectField
            id={`${id}-skill`}
            value={skillLevel}
            onValueChange={(value) =>
              setSkillLevel(value as SkillLevel | "UNSET")
            }
            disabled={busy}
          >
            <SelectItem value="UNSET">Prefer not to say</SelectItem>
            <SelectItem value="BEGINNER">Beginner</SelectItem>
            <SelectItem value="INTERMEDIATE">Intermediate</SelectItem>
            <SelectItem value="ADVANCED">Advanced</SelectItem>
          </SelectField>
        </Field>
        {error && <PlayerError message={error} />}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={!displayName.trim()} loading={busy}>
            Save profile
          </Button>
          {saved && (
            <p role="status" className="text-sm text-brand-700">
              Profile saved.
            </p>
          )}
        </div>
      </form>
    </Card>
  );
}

function SessionCard({ session }: { session: PlayerSessionView }) {
  return (
    <Card className="flex min-w-0 flex-col gap-4 rounded-xl bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-3">
        <PlayerBookingFacts booking={session.booking} />
        <AttendanceBadge attendance={session.attendance} />
        {session.canConfirmAttendance && session.attendance === "UNKNOWN" && (
          <p className="text-xs text-ink-soft">
            Confirm your attendance to add this session to your history.
          </p>
        )}
      </div>
      <Button asChild variant="outline" className="w-full sm:w-auto">
        <Link
          href={`/players/sessions/${encodeURIComponent(session.booking.id)}`}
        >
          View session
        </Link>
      </Button>
    </Card>
  );
}

function DashboardContent({
  data,
  refresh,
}: {
  data: PlayerDashboardView;
  refresh: () => Promise<void>;
}) {
  const [older, setOlder] = useState<PlayerSessionView[]>([]);
  const [olderPending, setOlderPending] = useState<PlayerSessionView[]>([]);
  const [pendingCursor, setPendingCursor] = useState(data.pendingNextCursor);
  const [pendingBusy, setPendingBusy] = useState(false);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(data.nextCursor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function loadOlder() {
    if (!cursor || busy) return;
    setBusy(true);
    setError(null);
    try {
      const page = await playerRequest<PlayerDashboardView>(
        `/api/players/me?before=${encodeURIComponent(cursor)}`,
      );
      setOlder((old) => [
        ...old,
        ...page.history.filter(
          (session) =>
            ![...data.history, ...old].some(
              (item) => item.participantId === session.participantId,
            ),
        ),
      ]);
      setCursor(page.nextCursor);
    } catch (cause) {
      setError(playerError(cause));
    } finally {
      setBusy(false);
    }
  }
  const history = [...data.history, ...older];
  const pending = [...data.pending, ...olderPending];
  async function loadPending() {
    if (!pendingCursor || pendingBusy) return;
    setPendingBusy(true);
    setPendingError(null);
    try {
      const page = await playerRequest<PlayerDashboardView>(`/api/players/me?pendingBefore=${encodeURIComponent(pendingCursor)}`);
      setOlderPending(old => [...old, ...page.pending.filter(s => ![...data.pending, ...old].some(p => p.participantId === s.participantId))]);
      setPendingCursor(page.pendingNextCursor);
    } catch (cause) {
      setPendingError(playerError(cause));
    } finally { setPendingBusy(false); }
  }
  const counters = [
    {
      label: "Confirmed sessions",
      value: data.totals.sessions,
      Icon: CalendarCheck,
    },
    { label: "Venues", value: data.totals.venues, Icon: MapPin },
    { label: "Courts", value: data.totals.courts, Icon: Trophy },
  ];
  return (
    <div className="space-y-7">
      <PlayerPrivacy />
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {counters.map(({ label, value, Icon }) => (
          <Card key={label} className="rounded-xl bg-secondary/40 p-3 sm:p-5">
            <Icon className="mb-2 size-5 text-brand-700" aria-hidden />
            <p className="text-2xl font-semibold text-brand-700 sm:text-3xl">
              {value}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft sm:text-sm">
              {label}
            </p>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ResultSummary
          title="Peer-confirmed results"
          totals={data.totals.confirmed}
        />
        <ResultSummary
          title="Self-reported results"
          totals={data.totals.selfReported}
        />
      </div>
      <p className="text-sm leading-relaxed text-ink-soft">
        Only completed sessions with your confirmed attendance count. Pending,
        disputed, and unfinished games are excluded from totals.
      </p>
      <ProfileForm
        key={`${data.profile.displayName}:${data.profile.skillLevel}`}
        profile={data.profile}
        onSaved={refresh}
      />
      {pending.length > 0 && (
        <section
          className="space-y-4"
          aria-label="Upcoming and unconfirmed sessions"
        >
          <h2 className="text-xl font-semibold">
            Upcoming and unconfirmed sessions
          </h2>
          <p className="text-sm text-ink-soft">
            Planned reservations and sessions needing attendance confirmation.
          </p>
          {pending.map((session) => (
            <SessionCard key={session.participantId} session={session} />
          ))}
          {pendingError && <PlayerError message={pendingError} />}
          {pendingCursor && <Button variant="outline" loading={pendingBusy} onClick={() => void loadPending()}>Load more planned sessions</Button>}
        </section>
      )}
      <section className="space-y-4" aria-label="Private session history">
        <h2 className="text-xl font-semibold">Where you’ve played</h2>
        <p className="text-sm text-ink-soft">
          Sessions you confirmed attending. Reserved court time is not a measure
          of playing time.
        </p>
        {history.length === 0 ? (
          <Card className="rounded-xl border-dashed bg-white p-6">
            <p className="font-semibold">Your first session starts here</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Join a booking roster, then confirm your attendance after the
              completed session ends.
            </p>
          </Card>
        ) : (
          history.map((session) => (
            <SessionCard key={session.participantId} session={session} />
          ))
        )}
        {error && <PlayerError message={error} />}
        {cursor && (
          <Button
            variant="outline"
            loading={busy}
            onClick={() => void loadOlder()}
          >
            Load older sessions
          </Button>
        )}
      </section>
      {data.courts.length > 0 && (
        <section className="space-y-4" aria-label="Your court statistics">
          <h2 className="text-xl font-semibold">Your courts</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {data.courts.map((court) => (
              <Card
                key={court.courtId}
                className="space-y-3 rounded-xl bg-white p-5"
              >
                <h3 className="break-words font-semibold">
                  {court.venueName} · {court.courtName}
                </h3>
                <Badge tone="brand">
                  {court.sessions} confirmed{" "}
                  {court.sessions === 1 ? "session" : "sessions"}
                </Badge>
                <p className="text-sm text-ink-soft">
                  Peer-confirmed: {court.confirmed.wins} wins ·{" "}
                  {court.confirmed.losses} losses
                </p>
                <p className="text-sm text-ink-soft">
                  Self-reported: {court.selfReported.wins} wins ·{" "}
                  {court.selfReported.losses} losses
                </p>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function PlayerDashboard() {
  const { data, error, loading, refresh } =
    usePlayerResource<PlayerDashboardView>("/api/players/me");
  return (
    <PlayerShell
      title="My player history"
      description="Your sessions, courts, and game results — kept private."
    >
      <div className="space-y-5">
        {loading && <PlayerLoading />}
        {error && <PlayerError message={error} retry={() => void refresh()} />}
        {data && <DashboardContent data={data} refresh={refresh} />}
      </div>
    </PlayerShell>
  );
}
