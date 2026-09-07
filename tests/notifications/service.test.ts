import { randomUUID } from "node:crypto";
import { beforeEach, describe, it, expect } from "vitest";
import { prisma, resetDb } from "../db";
import { notificationService } from "@/lib/notifications/service";

beforeEach(resetDb);

async function user() {
  return prisma.user.create({ data: { email: `u-${randomUUID().slice(0, 8)}@t.test` } });
}

describe("notification read state", () => {
  it("creates an unread notification for the recipient", async () => {
    const u = await user();
    const n = await notificationService.create({ userId: u.id, type: "TEST", title: "Hi" });
    expect(n.readAt).toBeNull();
    expect(await notificationService.unreadCount(u.id)).toBe(1);
  });

  it("markRead is scoped to the owner (a stranger can't read it)", async () => {
    const u = await user();
    const stranger = await user();
    const n = await notificationService.create({ userId: u.id, type: "TEST", title: "Hi" });

    expect(await notificationService.markRead(stranger.id, n.id)).toBe(0);
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: n.id } })).readAt).toBeNull();

    expect(await notificationService.markRead(u.id, n.id)).toBe(1);
    expect((await prisma.notification.findUniqueOrThrow({ where: { id: n.id } })).readAt).not.toBeNull();
    expect(await notificationService.markRead(u.id, n.id)).toBe(0); // already read
  });

  it("marks all read and returns the count cleared", async () => {
    const u = await user();
    await notificationService.create({ userId: u.id, type: "A", title: "1" });
    await notificationService.create({ userId: u.id, type: "B", title: "2" });
    await notificationService.create({ userId: u.id, type: "C", title: "3" });
    expect(await notificationService.markAllRead(u.id)).toBe(3);
    expect(await notificationService.unreadCount(u.id)).toBe(0);
  });

  it("lists only the user's own notifications", async () => {
    const u = await user();
    const other = await user();
    await notificationService.create({ userId: u.id, type: "A", title: "mine" });
    await notificationService.create({ userId: other.id, type: "A", title: "theirs" });
    const list = await notificationService.listForUser(u.id);
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("mine");
  });

  it("createOnce dedupes by (user, type, booking)", async () => {
    const u = await user();
    await notificationService.createOnce({ userId: u.id, type: "R", title: "x", bookingId: "b1" });
    await notificationService.createOnce({ userId: u.id, type: "R", title: "x", bookingId: "b1" });
    expect(await prisma.notification.count({ where: { userId: u.id, type: "R" } })).toBe(1);
  });
});
