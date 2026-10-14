"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { SelectField, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  MatchFormat,
  MatchInput,
  MatchView,
  ParticipantView,
  RevisionView,
  Winner,
} from "@/lib/players/types";
import { MatchVerification, PlayerError, PlayerLoading } from "./PlayerShared";
import { playerError, playerRequest } from "./player-client";

function ResultDetails({ revision }: { revision: RevisionView }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {(["A", "B"] as const).map((team) => (
          <div key={team} className="min-w-0 rounded-xl bg-secondary/40 p-3">
            <p className="text-xs font-semibold text-brand-700">
              Team {team}
              {revision.winner === team ? " · Winner" : ""}
            </p>
            <p className="mt-1 break-words text-sm font-medium">
              {(team === "A" ? revision.teamA : revision.teamB)
                .map((player) => player.nickname)
                .join(" & ")}
            </p>
            {(team === "A" ? revision.scoreA : revision.scoreB) !== null && (
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {team === "A" ? revision.scoreA : revision.scoreB}
              </p>
            )}
          </div>
        ))}
      </div>
      {revision.winner === "UNFINISHED" && (
        <p className="text-sm text-ink-soft">
          Game unfinished · No wins or losses recorded.
        </p>
      )}
      {revision.note && (
        <p className="whitespace-pre-wrap break-words text-sm text-ink-soft">
          {revision.note}
        </p>
      )}
      {revision.votes.length > 0 && (
        <ul
          className="space-y-1 text-xs text-ink-soft"
          aria-label="Result responses"
        >
          {revision.votes.map((vote, index) => (
            <li key={`${vote.nickname}-${index}`} className="break-words">
              {vote.nickname}:{" "}
              {vote.decision === "CONFIRMED" ? "confirmed" : "disputed"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PlayerMatchForm({
  bookingId,
  participants,
  match,
  onSaved,
}: {
  bookingId: string;
  participants: ParticipantView[];
  match?: MatchView;
  onSaved: () => Promise<void>;
}) {
  const id = useId();
  const submissionId = useRef<string | null>(null);
  const [format, setFormat] = useState<MatchFormat>(match?.format ?? "SINGLES");
  const [teamA, setTeamA] = useState<string[]>(
    match?.teamA.map((player) => player.id) ?? [""],
  );
  const [teamB, setTeamB] = useState<string[]>(
    match?.teamB.map((player) => player.id) ?? [""],
  );
  const [winner, setWinner] = useState<Winner>(match?.winner ?? "UNFINISHED");
  const [scoreA, setScoreA] = useState(match?.scoreA?.toString() ?? "");
  const [scoreB, setScoreB] = useState(match?.scoreB?.toString() ?? "");
  const [note, setNote] = useState(match?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attended = participants.filter(
    (player) => player.attendance === "ATTENDED",
  );

  function changeFormat(value: MatchFormat) {
    const count = value === "SINGLES" ? 1 : 2;
    setFormat(value);
    setTeamA((team) =>
      Array.from({ length: count }, (_, index) => team[index] ?? ""),
    );
    setTeamB((team) =>
      Array.from({ length: count }, (_, index) => team[index] ?? ""),
    );
  }

  async function save() {
    setError(null);
    const count = format === "SINGLES" ? 1 : 2;
    const ids = [...teamA, ...teamB];
    if (
      teamA.length !== count ||
      teamB.length !== count ||
      ids.some(
        (playerId) => !attended.some((player) => player.id === playerId),
      ) ||
      new Set(ids).size !== count * 2
    ) {
      setError(
        `Choose ${count} distinct attended ${count === 1 ? "player" : "players"} for each team.`,
      );
      return;
    }
    if (Boolean(scoreA.trim()) !== Boolean(scoreB.trim())) {
      setError("Enter both scores or leave both blank.");
      return;
    }
    const hasScores = Boolean(scoreA.trim());
    const a = hasScores ? Number(scoreA) : null;
    const b = hasScores ? Number(scoreB) : null;
    if (
      hasScores &&
      ![a, b].every(
        (score) =>
          Number.isInteger(score) &&
          score !== null &&
          score >= 0 &&
          score <= 999,
      )
    ) {
      setError("Scores must be whole numbers from 0 to 999.");
      return;
    }
    if (
      a !== null &&
      b !== null &&
      ((winner === "A" && a <= b) || (winner === "B" && b <= a))
    ) {
      setError("The winning team must have the higher score.");
      return;
    }
    const input: MatchInput = {
      format,
      teamA,
      teamB,
      winner,
      scoreA: a,
      scoreB: b,
      note: note.trim(),
    };
    setBusy(true);
    try {
      if (match)
        await playerRequest(
          `/api/players/matches/${encodeURIComponent(match.id)}`,
          {
            method: "PATCH",
            body: { ...input, expectedRevision: match.number },
          },
        );
      else {
        submissionId.current ??= crypto.randomUUID();
        await playerRequest(
          `/api/players/bookings/${encodeURIComponent(bookingId)}/matches`,
          { body: { ...input, submissionId: submissionId.current } },
        );
      }
      await onSaved();
    } catch (cause) {
      setError(playerError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      noValidate
    >
      <Field label="Game format" htmlFor={`${id}-format`}>
        <SelectField
          id={`${id}-format`}
          value={format}
          onValueChange={(value) => changeFormat(value as MatchFormat)}
          disabled={busy}
        >
          <SelectItem value="SINGLES">Singles · 1 per team</SelectItem>
          <SelectItem value="DOUBLES">Doubles · 2 per team</SelectItem>
        </SelectField>
      </Field>
      <p className="text-sm text-ink-soft">
        Select only players whose attendance is confirmed or reported.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {(["A", "B"] as const).map((team) => (
          <fieldset
            key={team}
            className="min-w-0 space-y-3 rounded-xl border bg-secondary/20 p-3"
          >
            <legend className="px-1 text-sm font-semibold">Team {team}</legend>
            {(team === "A" ? teamA : teamB).map((selected, index) => (
              <Field
                key={index}
                label={`Team ${team} player ${index + 1}`}
                htmlFor={`${id}-${team}-${index}`}
              >
                <SelectField
                  id={`${id}-${team}-${index}`}
                  value={selected || undefined}
                  placeholder="Choose player"
                  disabled={busy}
                  onValueChange={(value) =>
                    (team === "A" ? setTeamA : setTeamB)((old) =>
                      old.map((playerId, slot) =>
                        slot === index ? value : playerId,
                      ),
                    )
                  }
                >
                  {attended
                    .filter(
                      (player) =>
                        player.id === selected ||
                        ![...teamA, ...teamB].includes(player.id),
                    )
                    .map((player) => (
                      <SelectItem key={player.id} value={player.id}>
                        {player.nickname}
                        {player.isGuest ? " (guest)" : ""}
                      </SelectItem>
                    ))}
                </SelectField>
              </Field>
            ))}
            <Field label={`Team ${team} score`} htmlFor={`${id}-${team}-score`}>
              <Input
                id={`${id}-${team}-score`}
                type="number"
                inputMode="numeric"
                min={0}
                max={999}
                step={1}
                placeholder="Optional"
                value={team === "A" ? scoreA : scoreB}
                disabled={busy}
                onChange={(event) =>
                  (team === "A" ? setScoreA : setScoreB)(event.target.value)
                }
              />
            </Field>
          </fieldset>
        ))}
      </div>
      <Field label="Outcome" htmlFor={`${id}-outcome`}>
        <SelectField
          id={`${id}-outcome`}
          value={winner}
          onValueChange={(value) => setWinner(value as Winner)}
          disabled={busy}
        >
          <SelectItem value="UNFINISHED">Unfinished</SelectItem>
          <SelectItem value="A">Team A won</SelectItem>
          <SelectItem value="B">Team B won</SelectItem>
        </SelectField>
      </Field>
      <Field label="Game note (optional)" htmlFor={`${id}-note`}>
        <Textarea
          id={`${id}-note`}
          maxLength={200}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          disabled={busy}
          className="min-h-20"
        />
      </Field>
      <p className="text-xs leading-relaxed text-ink-soft">
        Registered game participants confirm the same result revision.
        Corrections require fresh confirmations.
      </p>
      {error && <PlayerError message={error} />}
      <Button type="submit" loading={busy} className="w-full">
        {match ? "Save correction" : "Save game"}
      </Button>
    </form>
  );
}

function MatchHistory({ matchId }: { matchId: string }) {
  const [revisions, setRevisions] = useState<RevisionView[]>([]);
  const [hasOlder, setHasOlder] = useState(true);
  const [started, setStarted] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void playerRequest<{ revisions: RevisionView[]; hasOlder: boolean }>(
      `/api/players/matches/${encodeURIComponent(matchId)}/history`,
      { signal: controller.signal },
    )
      .then((page) => {
        if (controller.signal.aborted) return;
        setRevisions(page.revisions);
        setHasOlder(page.hasOlder);
        setStarted(true);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(playerError(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [matchId]);
  async function load() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const before = revisions.length
        ? `?before=${Math.min(...revisions.map((revision) => revision.number))}`
        : "";
      const page = await playerRequest<{
        revisions: RevisionView[];
        hasOlder: boolean;
      }>(
        `/api/players/matches/${encodeURIComponent(matchId)}/history${before}`,
      );
      setRevisions((old) => [
        ...old,
        ...page.revisions.filter(
          (revision) => !old.some((item) => item.number === revision.number),
        ),
      ]);
      setHasOlder(page.hasOlder);
      setStarted(true);
    } catch (cause) {
      setError(playerError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-soft">
        Previous claims and responses are retained. Only the current revision
        can count toward totals.
      </p>
      {busy && !started && <PlayerLoading />}
      {revisions.map((revision) => (
        <Card key={revision.number} className="space-y-3 rounded-xl p-4">
          <h3 className="font-semibold">Revision {revision.number}</h3>
          <p className="text-xs text-ink-soft">
            {new Date(revision.createdAt).toLocaleString("en-PH", {
              timeZone: "Asia/Manila",
            })}{" "}
            · Philippine time
          </p>
          <ResultDetails revision={revision} />
        </Card>
      ))}
      {started && !revisions.length && (
        <p className="text-sm text-ink-soft">No result revisions yet.</p>
      )}
      {error && <PlayerError message={error} />}
      {hasOlder && (
        <Button variant="outline" loading={busy} onClick={() => void load()}>
          {started ? "Load older revisions" : "Load result history"}
        </Button>
      )}
    </div>
  );
}

function PlayerMatchCard({
  match,
  bookingId,
  participants,
  refresh,
}: {
  match: MatchView;
  bookingId: string;
  participants: ParticipantView[];
  refresh: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [history, setHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function vote(decision: "CONFIRMED" | "DISPUTED") {
    setBusy(true);
    setError(null);
    try {
      await playerRequest(
        `/api/players/matches/${encodeURIComponent(match.id)}/vote`,
        { body: { expectedRevision: match.number, decision } },
      );
      await refresh();
    } catch (cause) {
      setError(playerError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="min-w-0 space-y-4 rounded-xl bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <MatchVerification verification={match.verification} />
        <Badge tone="neutral">
          {match.format === "SINGLES" ? "Singles" : "Doubles"} · Revision{" "}
          {match.number}
        </Badge>
      </div>
      <ResultDetails revision={match} />
      {match.verification === "DISPUTED" && (
        <p className="text-sm text-red-700">
          Excluded from totals while disputed. A corrected result needs fresh
          confirmations.
        </p>
      )}
      {match.verification === "PENDING" && (
        <p className="text-sm text-ink-soft">
          Excluded from totals until the required players confirm this revision.
        </p>
      )}
      {match.verification === "SELF_REPORTED" && (
        <p className="text-xs text-ink-soft">
          No registered opponent confirmed this result. It counts only in
          self-reported totals.
        </p>
      )}
      {match.myDecision && (
        <p className="text-xs text-ink-soft">
          Your response:{" "}
          {match.myDecision === "CONFIRMED" ? "confirmed" : "disputed"}.
        </p>
      )}
      {error && <PlayerError message={error} />}
      {(match.canVote || match.canDispute) && (
        <div className="flex flex-wrap gap-2">
          {match.canVote && <Button
            variant="secondary"
            disabled={busy || match.myDecision === "CONFIRMED"}
            onClick={() => void vote("CONFIRMED")}
          >
            Confirm result
          </Button>}
          {match.canDispute && <Button
            variant="outline"
            disabled={busy || match.myDecision === "DISPUTED"}
            onClick={() => void vote("DISPUTED")}
          >
            Dispute result
          </Button>}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {match.canEdit && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setEditing(true)}
          >
            Propose correction
          </Button>
        )}
        <Button variant="ghost" onClick={() => setHistory(true)}>
          Result history ({match.revisionCount})
        </Button>
      </div>
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent
          title="Correct game result"
          description="Saving creates a new revision. All registered participants must confirm the new result."
          className="rounded-t-xl sm:rounded-xl motion-reduce:animate-none"
        >
          <PlayerMatchForm
            key={match.number}
            bookingId={bookingId}
            participants={participants}
            match={match}
            onSaved={async () => {
              setEditing(false);
              await refresh();
            }}
          />
        </DialogContent>
      </Dialog>
      <Dialog open={history} onOpenChange={setHistory}>
        <DialogContent
          title="Result history"
          description="Review the saved revisions and player responses."
          className="rounded-t-xl sm:rounded-xl motion-reduce:animate-none"
        >
          {history && <MatchHistory matchId={match.id} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function PlayerMatches({
  bookingId,
  participants,
  matches,
  canRecord,
  refresh,
}: {
  bookingId: string;
  participants: ParticipantView[];
  matches: MatchView[];
  canRecord: boolean;
  refresh: () => Promise<void>;
}) {
  const [recording, setRecording] = useState(false);
  return (
    <section className="space-y-4" aria-label="Session games">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Games</h3>
        {canRecord && (
          <Button variant="secondary" onClick={() => setRecording(true)}>
            Record game
          </Button>
        )}
      </div>
      {matches.length === 0 ? (
        <p className="text-sm text-ink-soft">
          No games recorded. A session can have several singles or doubles
          games.
        </p>
      ) : (
        matches.map((match) => (
          <PlayerMatchCard
            key={match.id}
            match={match}
            bookingId={bookingId}
            participants={participants}
            refresh={refresh}
          />
        ))
      )}
      <Dialog open={recording} onOpenChange={setRecording}>
        <DialogContent
          title="Record game"
          description="Record a singles or doubles result with attended players."
          className="rounded-t-xl sm:rounded-xl motion-reduce:animate-none"
        >
          {recording && (
            <PlayerMatchForm
              bookingId={bookingId}
              participants={participants}
              onSaved={async () => {
                setRecording(false);
                await refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
