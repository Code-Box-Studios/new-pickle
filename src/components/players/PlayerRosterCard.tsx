"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Copy, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import type { Attendance, RosterView } from "@/lib/players/types";
import {
  AttendanceBadge,
  PlayerBookingFacts,
  PlayerError,
  PlayerLoading,
} from "./PlayerShared";
import { PlayerMatches } from "./PlayerMatches";
import { playerError, playerRequest, usePlayerResource } from "./player-client";

function AttendanceControls({
  nickname,
  attendance,
  busy,
  onChange,
}: {
  nickname: string;
  attendance: Attendance;
  busy: boolean;
  onChange: (attendance: Attendance) => void;
}) {
  return (
    <div
      role="group"
      aria-label={`Attendance for ${nickname}`}
      className="flex flex-wrap gap-2"
    >
      {(["ATTENDED", "ABSENT", "UNKNOWN"] as const).map((value) => (
        <Button
          key={value}
          size="xs"
          variant={value === attendance ? "secondary" : "outline"}
          aria-pressed={value === attendance}
          disabled={busy || value === attendance}
          onClick={() => onChange(value)}
        >
          {value === "ATTENDED"
            ? "Attended"
            : value === "ABSENT"
              ? "Absent"
              : "Unconfirmed"}
        </Button>
      ))}
    </div>
  );
}

function RosterContent({
  data,
  compact,
  refresh,
}: {
  data: RosterView;
  compact: boolean;
  refresh: () => Promise<void>;
}) {
  const id = useId();
  const [guestNickname, setGuestNickname] = useState("");
  const [selfNickname, setSelfNickname] = useState("");
  const [inviteLabel, setInviteLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [share, setShare] = useState<{ url: string; expiresAt: string } | null>(
    null,
  );
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const base = `/api/players/bookings/${encodeURIComponent(data.booking.id)}`;
  const canLeave = data.canLeave;

  async function mutate(path: string, body: unknown, onSuccess?: () => void) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await playerRequest(path, { body });
      onSuccess?.();
      await refresh();
    } catch (cause) {
      setError(playerError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function createInvite() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await playerRequest<{
        invitationId: string;
        token: string;
        expiresAt: string;
      }>(`${base}/invitations`, {
        body: inviteLabel.trim() ? { label: inviteLabel.trim() } : {},
      });
      setShare({
        url: `${window.location.origin}/players/invite#${result.token}`,
        expiresAt: result.expiresAt,
      });
      setCopied(false);
      setCopyError(null);
      setInviteLabel("");
      await refresh();
    } catch (cause) {
      setError(playerError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
      setCopyError(null);
    } catch {
      setCopyError(
        "Copy is unavailable. Select the invitation link and copy it manually.",
      );
    }
  }

  return (
    <Card className="min-w-0 space-y-5 rounded-xl bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Users className="size-5 text-brand-700" aria-hidden />
            {compact ? "Players (optional)" : "Session roster"}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            Guests need only a nickname. Joining a roster does not confirm
            attendance.
          </p>
        </div>
        <Badge tone="neutral">
          {data.participants.length}{" "}
          {data.participants.length === 1 ? "player" : "players"}
        </Badge>
      </div>
      {!compact && <PlayerBookingFacts booking={data.booking} />}
      {error && <PlayerError message={error} />}
      {data.participants.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-sm leading-relaxed text-ink-soft">
          No players listed yet. You can keep booking without a roster.
        </p>
      ) : (
        <ul className="space-y-3" aria-label="Session players">
          {data.participants.map((player) => (
            <li
              key={player.id}
              className="space-y-3 rounded-xl border border-line/70 p-3 sm:p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-words font-medium">
                    {player.nickname}
                    {player.isMe && (
                      <span className="ml-1 text-xs text-brand-700">(you)</span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {player.isGuest
                      ? "Guest · Reported by holder"
                      : "Registered player"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <AttendanceBadge attendance={player.attendance} />
                  {data.isHolder && data.canEdit && !player.isMe && (
                    <Button
                      size="xs"
                      variant="ghost"
                      disabled={busy}
                      aria-label={`Remove ${player.nickname}`}
                      onClick={() =>
                        void mutate(
                          `${base}/participants/${encodeURIComponent(player.id)}/remove`,
                          {},
                        )
                      }
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
              {player.isGuest && player.attendance !== "UNKNOWN" && (
                <p className="text-xs text-ink-soft">Reported by holder</p>
              )}
              {data.canConfirmAttendance &&
                (player.isMe || (data.isHolder && player.isGuest)) && (
                  <AttendanceControls
                    nickname={player.nickname}
                    attendance={player.attendance}
                    busy={busy}
                    onChange={(attendance) =>
                      void mutate(
                        `${base}/participants/${encodeURIComponent(player.id)}/attendance`,
                        { attendance },
                      )
                    }
                  />
                )}
            </li>
          ))}
        </ul>
      )}
      {data.isHolder && data.canEdit && (
        <div className="space-y-5 border-t pt-5">
          {!data.selfParticipantId && (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void mutate(
                  `${base}/join`,
                  selfNickname.trim() ? { nickname: selfNickname.trim() } : {},
                  () => setSelfNickname(""),
                );
              }}
            >
              <Field
                label="Your session nickname (optional)"
                htmlFor={`${id}-self`}
                hint="Booking ownership does not automatically add you as a player."
              >
                <Input
                  id={`${id}-self`}
                  value={selfNickname}
                  onChange={(event) => setSelfNickname(event.target.value)}
                  maxLength={60}
                  disabled={busy}
                  autoComplete="nickname"
                />
              </Field>
              <Button type="submit" variant="secondary" disabled={busy}>
                Add myself to roster
              </Button>
            </form>
          )}
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void mutate(
                `${base}/guests`,
                { nickname: guestNickname.trim() },
                () => setGuestNickname(""),
              );
            }}
          >
            <Field
              label="Guest nickname"
              htmlFor={`${id}-guest`}
              hint="Guest entries stay local to this booking. No account or contact details needed."
            >
              <Input
                id={`${id}-guest`}
                value={guestNickname}
                onChange={(event) => setGuestNickname(event.target.value)}
                maxLength={60}
                required
                disabled={busy}
                autoComplete="off"
              />
            </Field>
            <Button
              type="submit"
              variant="outline"
              disabled={busy || !guestNickname.trim()}
            >
              Add guest
            </Button>
          </form>
        </div>
      )}
      {data.isHolder && data.canInvite && (
        <form
          className="space-y-3 border-t pt-5"
          onSubmit={(event) => {
            event.preventDefault();
            void createInvite();
          }}
        >
          <Field
            label="Invitation label (optional)"
            htmlFor={`${id}-invite`}
            hint="Share a link so a registered player can choose to join."
          >
            <Input
              id={`${id}-invite`}
              value={inviteLabel}
              onChange={(event) => setInviteLabel(event.target.value)}
              maxLength={60}
              disabled={busy}
              autoComplete="off"
            />
          </Field>
          <Button type="submit" variant="secondary" disabled={busy}>
            Create invite link
          </Button>
        </form>
      )}
      {data.isHolder && !data.canInvite && data.canEdit && (
        <p className="text-xs text-ink-soft">
          Invitation links become available after the booking is confirmed.
        </p>
      )}
      {data.isHolder && data.invitations.length > 0 && (
        <section className="space-y-3" aria-label="Roster invitations">
          <h3 className="text-sm font-semibold">Invitations</h3>
          <ul className="space-y-2">
            {data.invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"
              >
                <span className="min-w-0 break-words text-sm">
                  {invitation.label || "Player invitation"}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    tone={
                      invitation.status === "ACCEPTED"
                        ? "brand"
                        : invitation.status === "OPEN"
                          ? "amber"
                          : "neutral"
                    }
                  >
                    {invitation.status === "OPEN"
                      ? "Open"
                      : invitation.status.charAt(0) +
                        invitation.status.slice(1).toLowerCase()}
                  </Badge>
                  {invitation.status === "OPEN" && data.canInvite && (
                    <Button
                      variant="ghost"
                      size="xs"
                      disabled={busy}
                      aria-label={`Revoke ${invitation.label || "player invitation"}`}
                      onClick={() =>
                        void mutate(
                          `${base}/invitations/${encodeURIComponent(invitation.id)}/revoke`,
                          {},
                        )
                      }
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {canLeave && (
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => void mutate(`${base}/leave`, {})}
        >
          Leave roster
        </Button>
      )}
      {!data.canConfirmAttendance && (
        <p className="rounded-xl bg-secondary/40 p-3 text-sm leading-relaxed text-ink-soft">
          Attendance and game recording open after the booking is completed and
          the scheduled session has ended.
        </p>
      )}
      {compact ? (
        <Button asChild variant="outline" className="w-full">
          <Link
            href={`/players/sessions/${encodeURIComponent(data.booking.id)}`}
          >
            View session and games
          </Link>
        </Button>
      ) : (
        <div className="border-t pt-5">
          <PlayerMatches
            bookingId={data.booking.id}
            participants={data.participants}
            matches={data.matches}
            canRecord={data.canRecord}
            refresh={refresh}
          />
        </div>
      )}
      <Dialog
        open={Boolean(share)}
        onOpenChange={(open) => {
          if (!open) {
            setShare(null);
            setCopyError(null);
            setCopied(false);
          }
        }}
      >
        <DialogContent
          title="Share player invitation"
          description="Share this link with the intended player. Anyone with the link can respond."
          className="rounded-t-xl sm:rounded-xl motion-reduce:animate-none"
        >
          {share && (
            <div className="space-y-4">
              <Field label="Invitation link" htmlFor={`${id}-share`}>
                <Input
                  id={`${id}-share`}
                  readOnly
                  value={share.url}
                  onFocus={(event) => event.target.select()}
                />
              </Field>
              <p className="text-xs leading-relaxed text-ink-soft">
                Expires{" "}
                {new Date(share.expiresAt).toLocaleString("en-PH", {
                  timeZone: "Asia/Manila",
                })}{" "}
                · Philippine time. Copy it now; the saved invitation cannot show
                this link again.
              </p>
              {copyError && <PlayerError message={copyError} />}
              <Button className="w-full" onClick={() => void copyLink()}>
                <Copy className="size-4" aria-hidden />
                {copied ? "Link copied" : "Copy invite link"}
              </Button>
              {copied && (
                <p role="status" className="text-sm text-brand-700">
                  Invitation link copied.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function PlayerRosterCard({
  bookingId,
  compact = false,
}: {
  bookingId: string;
  compact?: boolean;
}) {
  const { data, error, loading, refresh } = usePlayerResource<RosterView>(
    `/api/players/bookings/${encodeURIComponent(bookingId)}`,
  );
  return (
    <div className="min-w-0 space-y-4">
      {loading && <PlayerLoading />}
      {error && <PlayerError message={error} retry={() => void refresh()} />}
      {data && (
        <RosterContent
          key={data.booking.id}
          data={data}
          compact={compact}
          refresh={refresh}
        />
      )}
    </div>
  );
}
