import { prisma } from "../db";
import { seedConfirmedBooking, seedCustomer } from "../factories";
import { joinRoster, addGuest } from "@/lib/players/roster";
import { createInvitation, acceptInvitation } from "@/lib/players/invitations";
import { setAttendance } from "@/lib/players/attendance";

export async function gameSetup() {
  const b = await seedConfirmedBooking();
  const self = await joinRoster(b.customerId, b.bookingId, "Me");
  const u = await seedCustomer();
  const opponent = await acceptInvitation(u.id, (await createInvitation(b.customerId, b.bookingId)).token, "Opponent");
  const g1 = await addGuest(b.customerId, b.bookingId, "Guest A");
  const g2 = await addGuest(b.customerId, b.bookingId, "Guest B");
  return { ...b, self: self.participantId, opponent: opponent.participantId, otherId: u.id, g1: g1.participantId, g2: g2.participantId };
}
export async function finish(o: Awaited<ReturnType<typeof gameSetup>>) {
  await prisma.booking.update({ where: { id: o.bookingId }, data: { status: "COMPLETED", startsAt: new Date(Date.now() - 86400000), endsAt: new Date(Date.now() - 80000000) } });
  await setAttendance(o.customerId, o.bookingId, o.self, "ATTENDED");
  await setAttendance(o.otherId, o.bookingId, o.opponent, "ATTENDED");
  await setAttendance(o.customerId, o.bookingId, o.g1, "ATTENDED");
  await setAttendance(o.customerId, o.bookingId, o.g2, "ATTENDED");
}
