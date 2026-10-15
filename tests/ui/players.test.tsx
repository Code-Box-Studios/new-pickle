// @vitest-environment jsdom
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlayerRosterCard } from "@/components/players/PlayerRosterCard";
import { PlayerDashboard } from "@/components/players/PlayerDashboard";
import { PlayerInvitation } from "@/components/players/PlayerInvitation";
import { PlayerMatchForm } from "@/components/players/PlayerMatches";
import type {
  InvitationView,
  MatchView,
  PlayerDashboardView,
  RosterView,
} from "@/lib/players/types";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status });
const participants: RosterView["participants"] = [
  {
    id: "me",
    nickname: "Jess",
    isGuest: false,
    isMe: true,
    attendance: "ATTENDED",
  },
  {
    id: "other",
    nickname: "Sam",
    isGuest: false,
    isMe: false,
    attendance: "ATTENDED",
  },
  {
    id: "guest",
    nickname: "Lee",
    isGuest: true,
    isMe: false,
    attendance: "ATTENDED",
  },
  {
    id: "absent",
    nickname: "Absent player",
    isGuest: true,
    isMe: false,
    attendance: "ABSENT",
  },
];
const booking = {
  id: "booking-1",
  venueName: "Green Court",
  courtName: "Court A",
  startsAt: "2026-10-15T18:00:00.000Z",
  endsAt: "2026-10-15T20:00:00.000Z",
  status: "COMPLETED",
};
const roster: RosterView = {
  booking,
  participants,
  isHolder: true,
  canEdit: false,
  canInvite: false,
  canLeave: false,
  canRecord: true,
  canConfirmAttendance: true,
  selfParticipantId: "me",
  invitations: [],
  matches: [],
};
const match: MatchView = {
  id: "match-1",
  number: 2,
  format: "SINGLES",
  teamA: [participants[0]],
  teamB: [participants[1]],
  winner: "A",
  scoreA: 11,
  scoreB: 8,
  note: null,
  createdAt: "2026-10-15T13:00:00.000Z",
  votes: [],
  verification: "DISPUTED",
  canEdit: true,
  canVote: true,
  canDispute: true,
  myDecision: null,
  revisionCount: 2,
};
const zero = { wins: 0, losses: 0, matches: 0, winRate: null };
const dashboard: PlayerDashboardView = {
  profile: { displayName: "Jess", skillLevel: null },
  totals: {
    sessions: 0,
    courts: 0,
    venues: 0,
    confirmed: zero,
    selfReported: { wins: 2, losses: 1, matches: 3, winRate: 2 / 3 },
  },
  courts: [],
  history: [],
  nextCursor: null,
  pending: [],
  pendingNextCursor: null,
};
const invitation: InvitationView = {
  venueName: booking.venueName,
  courtName: booking.courtName,
  startsAt: booking.startsAt,
  endsAt: booking.endsAt,
  expiresAt: "2026-10-15T17:00:00.000Z",
};
const token = "a".repeat(32);

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/players/invite");
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
});

describe("optional player rosters", () => {
  it("adds guests by nickname without collecting contact details", async () => {
    const fetcher = vi.fn(async (_path: string, init?: RequestInit) =>
      response(
        init?.method === "POST"
          ? { participantId: "new-guest" }
          : { ...roster, canEdit: true },
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    render(<PlayerRosterCard bookingId="booking-1" compact />);
    fireEvent.change(
      await screen.findByRole("textbox", { name: "Guest nickname" }),
      { target: { value: "Pat" } },
    );
    expect(
      screen.queryByRole("textbox", { name: /email|phone|mobile/i }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add guest" }));
    await waitFor(() =>
      expect(fetcher).toHaveBeenCalledWith(
        "/api/players/bookings/booking-1/guests",
        expect.objectContaining({
          body: JSON.stringify({ nickname: "Pat" }),
          cache: "no-store",
        }),
      ),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: "Guest nickname" }),
      ).toHaveValue(""),
    );
  });

  it("preserves a guest nickname when adding fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_path: string, init?: RequestInit) =>
        response(
          init?.method === "POST"
            ? { error: "Roster is full" }
            : { ...roster, canEdit: true },
          init?.method === "POST" ? 409 : 200,
        ),
      ),
    );
    render(<PlayerRosterCard bookingId="booking-1" compact />);
    fireEvent.change(
      await screen.findByRole("textbox", { name: "Guest nickname" }),
      { target: { value: "Pat" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Add guest" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Roster is full",
    );
    expect(screen.getByRole("textbox", { name: "Guest nickname" })).toHaveValue(
      "Pat",
    );
  });

  it("keeps attendance and games gated until a completed session has ended", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        response({ ...roster, canConfirmAttendance: false, canRecord: false }),
      ),
    );
    render(<PlayerRosterCard bookingId="booking-1" />);
    expect(await screen.findByText("Sam")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /mark.*attended|record.*game/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/completed.*ended/i)).toBeInTheDocument();
  });

  it("shows registered attendance controls only for self and labels guest reports", async () => {
    const fetcher = vi.fn(async () => response(roster));
    vi.stubGlobal("fetch", fetcher);
    render(<PlayerRosterCard bookingId="booking-1" />);
    const self = await screen.findByRole("group", {
      name: "Attendance for Jess",
    });
    expect(
      within(self).getByRole("button", { name: "Attended" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Attendance for Sam" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("Reported by holder").length).toBeGreaterThan(0);
    fireEvent.click(within(self).getByRole("button", { name: "Absent" }));
    await waitFor(() =>
      expect(fetcher).toHaveBeenCalledWith(
        "/api/players/bookings/booking-1/participants/me/attendance",
        expect.objectContaining({
          body: JSON.stringify({ attendance: "ABSENT" }),
        }),
      ),
    );
  });

  it("does not offer invitation creation before confirmation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        response({
          ...roster,
          booking: { ...booking, status: "PENDING_PAYMENT" },
          canEdit: true,
          canInvite: false,
          canRecord: false,
          canConfirmAttendance: false,
        }),
      ),
    );
    render(<PlayerRosterCard bookingId="booking-1" compact />);
    expect(
      await screen.findByRole("textbox", { name: "Guest nickname" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Create invite link" }),
    ).not.toBeInTheDocument();
  });
});

describe("private results and totals", () => {
  it("separates confirmed and self-reported results and leaves zero win rate blank", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response(dashboard)),
    );
    render(<PlayerDashboard />);
    const confirmed = await screen.findByRole("region", {
      name: "Peer-confirmed results",
    });
    expect(within(confirmed).getByText("—")).toBeInTheDocument();
    expect(within(confirmed).queryByText("0%")).not.toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Self-reported results" }),
    ).toHaveTextContent("2");
    expect(
      screen.queryByText(/playing hours|hours played/i),
    ).not.toBeInTheDocument();
  });

  it("preserves profile edits on a failed save", async () => {
    const fetcher = vi.fn(async (_path: string, init?: RequestInit) =>
      response(
        init?.method === "PATCH" ? { error: "Try again later" } : dashboard,
        init?.method === "PATCH" ? 503 : 200,
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    render(<PlayerDashboard />);
    fireEvent.change(
      await screen.findByRole("textbox", { name: "Display name" }),
      { target: { value: "New name" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Try again later",
    );
    expect(screen.getByRole("textbox", { name: "Display name" })).toHaveValue(
      "New name",
    );
    expect(fetcher).toHaveBeenCalledWith(
      "/api/players/me",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ displayName: "New name", skillLevel: null }),
      }),
    );
  });

  it("shows disputed results outside totals and votes on the current revision", async () => {
    const fetcher = vi.fn(async () =>
      response({ ...roster, matches: [match] }),
    );
    vi.stubGlobal("fetch", fetcher);
    render(<PlayerRosterCard bookingId="booking-1" />);
    expect(await screen.findByText("Disputed")).toBeInTheDocument();
    expect(screen.getByText(/excluded.*totals/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm result" }));
    await waitFor(() =>
      expect(fetcher).toHaveBeenCalledWith(
        "/api/players/matches/match-1/vote",
        expect.objectContaining({
          body: JSON.stringify({ expectedRevision: 2, decision: "CONFIRMED" }),
        }),
      ),
    );
  });

  it("selects only attended players and rejects a partial score", async () => {
    const fetcher = vi.fn<
      (path: string, init?: RequestInit) => Promise<Response>
    >(async () => response(roster));
    vi.stubGlobal("fetch", fetcher);
    render(<PlayerRosterCard bookingId="booking-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Record game" }));
    const dialog = screen.getByRole("dialog", { name: "Record game" });
    fireEvent.keyDown(
      within(dialog).getByRole("combobox", { name: "Team A player 1" }),
      { key: "ArrowDown" },
    );
    expect(
      screen.queryByRole("option", { name: /Absent player/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("option", { name: "Jess" }));
    fireEvent.keyDown(
      within(dialog).getByRole("combobox", { name: "Team B player 1" }),
      { key: "ArrowDown" },
    );
    expect(
      screen.queryByRole("option", { name: "Jess" }),
    ).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("option", { name: "Sam" }));
    fireEvent.change(
      within(dialog).getByRole("spinbutton", { name: "Team A score" }),
      { target: { value: "11" } },
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Save game" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      /both scores/i,
    );
    expect(fetcher.mock.calls.some(([, init]) => init?.method === "POST")).toBe(
      false,
    );
    expect(
      within(dialog).getByRole("spinbutton", { name: "Team A score" }),
    ).toHaveValue(11);
  });

  it("loads revision history on opening and keeps revisions after a paging failure", async () => {
    const fetcher = vi.fn(async (path: string) => {
      if (path.endsWith("/history"))
        return response({
          revisions: [{ ...match, number: 2 }],
          hasOlder: true,
        });
      if (path.endsWith("/history?before=2"))
        return response({ error: "Could not load older revisions" }, 503);
      return response({ ...roster, matches: [match] });
    });
    vi.stubGlobal("fetch", fetcher);
    render(<PlayerRosterCard bookingId="booking-1" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Result history (2)" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Result history" });
    expect(
      await within(dialog).findByRole("heading", { name: "Revision 2" }),
    ).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Load older revisions" }),
    );
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Could not load older revisions",
    );
    expect(
      within(dialog).getByRole("heading", { name: "Revision 2" }),
    ).toBeInTheDocument();
  });
});

describe("result dispute controls", () => {
  it("hides Leave roster when the server says a confirmed session has already started", async () => {
    vi.stubGlobal("fetch",vi.fn(async () => response({...roster,booking:{...booking,status:"CONFIRMED"},canLeave:false})));
    render(<PlayerRosterCard bookingId="booking-1" />);
    await screen.findByText("Sam");
    expect(screen.queryByRole("button",{name:"Leave roster"})).not.toBeInTheDocument();
  });
  it("retains the same game submission ID after a lost response", async () => {
    const bodies: {submissionId:string}[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_path: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      if (bodies.length === 1) throw new TypeError("Lost response");
      return response({matchId:"created",revision:1});
    }));
    const saved = vi.fn(async () => {});
    render(<PlayerMatchForm bookingId="booking-1" participants={participants} onSaved={saved} />);
    fireEvent.keyDown(screen.getByRole("combobox", {name:"Team A player 1"}), {key:"ArrowDown"});
    fireEvent.click(await screen.findByRole("option", {name:"Jess"}));
    fireEvent.keyDown(screen.getByRole("combobox", {name:"Team B player 1"}), {key:"ArrowDown"});
    fireEvent.click(await screen.findByRole("option", {name:"Sam"}));
    fireEvent.click(screen.getByRole("button", {name:"Save game"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("Lost response");
    fireEvent.click(screen.getByRole("button", {name:"Save game"}));
    await waitFor(() => expect(saved).toHaveBeenCalledOnce());
    expect(bodies).toHaveLength(2);
    expect(bodies[0].submissionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(bodies[1].submissionId).toBe(bodies[0].submissionId);
  });
  it("loads older planned sessions without replacing the current pending list", async () => {
    const pending = {participantId:"p1",booking,attendance:"UNKNOWN" as const,canConfirmAttendance:true};
    const fetcher = vi.fn(async (path: string) => response(path.includes("pendingBefore") ? {...dashboard,pending:[{...pending,participantId:"p2"}],pendingNextCursor:null} : {...dashboard,pending:[pending],pendingNextCursor:"p1"}));
    vi.stubGlobal("fetch", fetcher);
    render(<PlayerDashboard />);
    fireEvent.click(await screen.findByRole("button", {name:"Load more planned sessions"}));
    await waitFor(() => expect(screen.getAllByRole("link", {name:"View session"})).toHaveLength(2));
    expect(screen.queryByRole("button", {name:"Load more planned sessions"})).not.toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith("/api/players/me?pendingBefore=p1", expect.anything());
  });
  it("clears the private roster after a successful departure loses access", async () => {
    let left = false;
    vi.stubGlobal("fetch", vi.fn(async (path: string) => {
      if (path.endsWith("/leave")) { left = true; return response({ok:true}); }
      return left ? response({error:"No session access"},403) : response({...roster,isHolder:false,booking:{...booking,status:"CONFIRMED"},canConfirmAttendance:false,canLeave:true});
    }));
    render(<PlayerRosterCard bookingId="booking-1" />);
    fireEvent.click(await screen.findByRole("button", {name:"Leave roster"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("No session access");
    expect(screen.queryByText("Sam")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", {name:"Leave roster"})).not.toBeInTheDocument();
  });
  it("keeps dispute available when attendance prevents confirmation", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response({ ...roster, matches: [{ ...match, verification: "PENDING", canVote: false, canDispute: true }] })));
    render(<PlayerRosterCard bookingId="booking-1" />);
    expect(await screen.findByRole("button", { name: "Dispute result" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Confirm result" })).not.toBeInTheDocument();
  });
});

describe("private invitation links", () => {
  it("uses the fragment token and remembers it before a safe login redirect", async () => {
    window.history.replaceState({}, "", `/players/invite#${token}`);
    const fetcher = vi.fn(async (path: string) =>
      response(path.endsWith("lookup") ? invitation : { ok: true }),
    );
    vi.stubGlobal("fetch", fetcher);
    render(<PlayerInvitation initialToken={"b".repeat(32)} isAuthed={false} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Sign in to respond" }),
    );
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/login?next=%2Fplayers%2Finvite"),
    );
    expect(fetcher).toHaveBeenCalledWith(
      "/api/players/invitations/lookup",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token }),
      }),
    );
    expect(fetcher).toHaveBeenCalledWith(
      "/api/players/invitations/remember",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token }),
      }),
    );
    expect(fetcher.mock.calls.every(([path]) => !path.includes(token))).toBe(
      true,
    );
  });

  it("does not send an invalid invitation token", async () => {
    window.history.replaceState({}, "", "/players/invite#bad-token");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    render(<PlayerInvitation isAuthed />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /invalid|missing/i,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("keeps the nickname after failed acceptance and accepts without contact fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string) =>
        response(
          path.endsWith("accept")
            ? { error: "Invitation was revoked" }
            : invitation,
          path.endsWith("accept") ? 409 : 200,
        ),
      ),
    );
    render(<PlayerInvitation initialToken={token} isAuthed />);
    fireEvent.change(
      await screen.findByRole("textbox", {
        name: "Session nickname (optional)",
      }),
      { target: { value: "Pat" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Join roster" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invitation was revoked",
    );
    expect(
      screen.getByRole("textbox", { name: "Session nickname (optional)" }),
    ).toHaveValue("Pat");
    expect(push).not.toHaveBeenCalled();
  });
});
