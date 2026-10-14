import "server-only";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/booking/errors";
import { assertRosterAccess, audit, limitPlayerWrites, withPlayerBooking } from "./core";
import { assertFinished } from "./rules";
import type { Attendance } from "./types";

export async function setAttendance(userId: string, bookingId: string, participantId: string, attendance: Attendance) {
  if (!["UNKNOWN", "ATTENDED", "ABSENT"].includes(attendance)) throw new ValidationError("Choose attended, absent, or not confirmed.");
  return withPlayerBooking(userId, bookingId, async (tx, b) => {
    assertRosterAccess(b, userId); assertFinished(b);
    const p = b.participants.find(p => p.id === participantId && p.status === "ACTIVE");
    if (!p) throw new NotFoundError("Player not found");
    if (p.userId !== userId && !(p.userId === null && b.userId === userId)) throw new ForbiddenError("Confirm only your own attendance. Guests must be reported by the booking holder.");
    if (p.attendance === attendance) return;
    await limitPlayerWrites(tx, userId);
    await tx.bookingParticipant.update({ where: { id: p.id }, data: { attendance, attendanceAt: new Date(Date.now()) } });
    await tx.playSession.upsert({ where: { bookingId }, create: { bookingId }, update: {} });
    await audit(tx, userId, bookingId, "ATTENDANCE_CHANGED", { participantId: p.id, previous: p.attendance, attendance, reportedGuest: p.userId === null });
  });
}
