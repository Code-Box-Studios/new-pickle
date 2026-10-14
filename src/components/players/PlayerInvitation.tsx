"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import type { InvitationView } from "@/lib/players/types";
import {
  PlayerBookingFacts,
  PlayerError,
  PlayerLoading,
  PlayerShell,
} from "./PlayerShared";
import { playerError, playerRequest } from "./player-client";

export function PlayerInvitation({
  initialToken,
  isAuthed,
}: {
  initialToken?: string | null;
  isAuthed: boolean;
}) {
  const router = useRouter();
  const nicknameId = useId();
  const [token, setToken] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<InvitationView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [declined, setDeclined] = useState(false);

  useEffect(() => {
    const fragment = window.location.hash.slice(1);
    const candidate = fragment || initialToken || "";
    const controller = new AbortController();
    async function lookup() {
      if (!/^[A-Za-z0-9_-]{32}$/.test(candidate))
        throw new Error(
          "This invitation link is missing or invalid. Ask the booking holder for a new link.",
        );
      return playerRequest<InvitationView>("/api/players/invitations/lookup", {
        body: { token: candidate },
        signal: controller.signal,
      });
    }
    void lookup()
      .then((data) => {
        if (!controller.signal.aborted) {
          setToken(candidate);
          setInvitation(data);
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(playerError(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [initialToken]);

  async function respond(action: "accept" | "decline" | "remember") {
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (action === "accept") {
        const result = await playerRequest<{ bookingId: string }>(
          "/api/players/invitations/accept",
          {
            body: {
              token,
              ...(nickname.trim() ? { nickname: nickname.trim() } : {}),
            },
          },
        );
        router.push(
          `/players/sessions/${encodeURIComponent(result.bookingId)}`,
        );
      } else if (action === "remember") {
        await playerRequest("/api/players/invitations/remember", {
          body: { token },
        });
        router.push("/login?next=%2Fplayers%2Finvite");
      } else {
        await playerRequest("/api/players/invitations/decline", {
          body: { token },
        });
        setDeclined(true);
      }
    } catch (cause) {
      setError(playerError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PlayerShell
      title="You’re invited to play"
      description="Join this optional roster to share session attendance and game results."
    >
      <div className="mx-auto max-w-xl space-y-4">
        {loading && <PlayerLoading />}
        {error && <PlayerError message={error} />}
        {declined ? (
          <Card className="space-y-4 rounded-xl bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Invitation declined</h2>
            <p className="text-sm text-ink-soft">
              You have not joined this roster.
            </p>
            <Button asChild variant="outline">
              <Link href="/players">My player history</Link>
            </Button>
          </Card>
        ) : (
          invitation && (
            <Card className="space-y-5 rounded-xl bg-white p-5 sm:p-6">
              <Badge tone="brand">Player invitation</Badge>
              <PlayerBookingFacts booking={invitation} />
              <p className="text-sm leading-relaxed text-ink-soft">
                Roster membership gives access to this session. The booking
                holder manages the reservation and payment.
              </p>
              {isAuthed ? (
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void respond("accept");
                  }}
                >
                  <Field
                    label="Session nickname (optional)"
                    htmlFor={nicknameId}
                    hint="Your display name is used if you leave this blank."
                  >
                    <Input
                      id={nicknameId}
                      maxLength={60}
                      value={nickname}
                      onChange={(event) => setNickname(event.target.value)}
                      autoComplete="nickname"
                      disabled={busy}
                    />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" loading={busy}>
                      Join roster
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void respond("decline")}
                    >
                      Decline invitation
                    </Button>
                  </div>
                </form>
              ) : (
                <Button
                  loading={busy}
                  className="w-full"
                  onClick={() => void respond("remember")}
                >
                  Sign in to respond
                </Button>
              )}
              <p className="text-xs leading-relaxed text-ink-soft">
                Only share this invitation with the person you intend to invite.
                The holder can revoke it.
              </p>
            </Card>
          )
        )}
      </div>
    </PlayerShell>
  );
}
