import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import { assertPhoneOrigin } from "@/lib/auth/phone-origin";
import { assertFullAppEnabled } from "@/lib/deployment";
import { readJsonBody } from "@/lib/api/json";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/booking/errors";
import { errorResponse } from "@/lib/http";
import { addGuest, joinRoster, leaveRoster, removePlayer } from "./roster";
import { acceptInvitation, createInvitation, declineInvitation, lookupInvitation, revokeInvitation } from "./invitations";
import { setAttendance } from "./attendance";
import { createMatch, reviseMatch, voteMatch } from "./matches";
import { matchHistory, rosterView } from "./read";
import { playerDashboard, updatePlayerProfile } from "./statistics";
import type { Attendance, Decision, MatchInput, SkillLevel } from "./types";

function json(value: unknown, status = 200) { return NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store" } }); }
function clearInviteCookie(response: NextResponse) {
  response.cookies.set("pikol-player-invite", "", { path: "/players/invite", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 0 });
  return response;
}
export async function playerRequest(req: NextRequest, path: string[]) {
  try {
    assertFullAppEnabled();
    if (path.length > 5 || path.some(p => !/^[a-zA-Z0-9_-]{1,100}$/.test(p))) throw new NotFoundError();
    if (req.method === "GET") {
      const s = await requireUser();
      if (path.length === 1 && path[0] === "me") return json(await playerDashboard(s.id, req.nextUrl.searchParams.get("before") || undefined, req.nextUrl.searchParams.get("pendingBefore") || undefined));
      if (path.length === 2 && path[0] === "bookings") return json(await rosterView(s.id, path[1]));
      if (path.length === 3 && path[0] === "matches" && path[2] === "history") {
        const before = req.nextUrl.searchParams.get("before");
        return json(await matchHistory(s.id, path[1], before === null ? undefined : Number(before)));
      }
      throw new NotFoundError();
    }
    if (!req.headers.get("origin")) throw new ForbiddenError("Open Pikol directly to manage your player profile or session.");
    assertPhoneOrigin(req);
    const body = await readJsonBody(req);
    if (req.method === "POST" && path.length === 2 && path[0] === "invitations" && ["lookup", "remember"].includes(path[1])) {
      const view = await lookupInvitation(body.token);
      if (path[1] === "lookup") return json(view);
      const response = json({ ok: true });
      response.cookies.set("pikol-player-invite", body.token as string, { path: "/players/invite", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600 });
      return response;
    }
    const s = await requireUser();
    if (req.method === "PATCH") {
      if (path.length === 1 && path[0] === "me") return json(await updatePlayerProfile(s.id, { displayName: body.displayName as string, skillLevel: body.skillLevel as SkillLevel | null }));
      if (path.length === 2 && path[0] === "matches") return json(await reviseMatch(s.id, path[1], body.expectedRevision as number, body as unknown as MatchInput));
      throw new NotFoundError();
    }
    if (path.length === 2 && path[0] === "invitations") {
      if (path[1] === "accept") return clearInviteCookie(json(await acceptInvitation(s.id, body.token, body.nickname as string | undefined)));
      if (path[1] === "decline") { await declineInvitation(s.id, body.token); return clearInviteCookie(json({ ok: true })); }
    }
    if (path.length === 3 && path[0] === "bookings") {
      const id = path[1];
      switch (path[2]) {
        case "guests": return json(await addGuest(s.id, id, body.nickname), 201);
        case "join": return json(await joinRoster(s.id, id, body.nickname as string | undefined));
        case "leave": await leaveRoster(s.id, id); return json({ ok: true });
        case "invitations": return json(await createInvitation(s.id, id, body.label as string | undefined), 201);
        case "matches":
          if (typeof body.submissionId !== "string") throw new ValidationError("A game submission ID is required.");
          return json(await createMatch(s.id, id, body as unknown as MatchInput, body.submissionId), 201);
      }
    }
    if (path.length === 5 && path[0] === "bookings") {
      if (path[2] === "participants" && path[4] === "remove") { await removePlayer(s.id, path[1], path[3]); return json({ ok: true }); }
      if (path[2] === "participants" && path[4] === "attendance") { await setAttendance(s.id, path[1], path[3], body.attendance as Attendance); return json({ ok: true }); }
      if (path[2] === "invitations" && path[4] === "revoke") { await revokeInvitation(s.id, path[1], path[3]); return json({ ok: true }); }
    }
    if (path.length === 3 && path[0] === "matches" && path[2] === "vote") { await voteMatch(s.id, path[1], body.expectedRevision as number, body.decision as Decision); return json({ ok: true }); }
    throw new NotFoundError();
  } catch (e) { return errorResponse(e); }
}
