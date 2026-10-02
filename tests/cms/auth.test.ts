import { afterAll, beforeAll, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { signSession, SESSION_COOKIE } from "@/lib/auth/session";
import { resolveCmsAdmin } from "@/cms/auth";

const emails = [
  "cms-admin-test@rallypoint.test",
  "cms-owner-test@rallypoint.test",
];
let admin: { id: string; email: string; role: "ADMIN" };
let owner: { id: string; email: string; role: "OWNER" };
beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  const a = await prisma.user.create({
    data: { email: emails[0], role: "ADMIN" },
  });
  const o = await prisma.user.create({
    data: { email: emails[1], role: "OWNER" },
  });
  admin = { ...a, role: "ADMIN" };
  owner = { ...o, role: "OWNER" };
});
afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
});
const headersFor = (token: string) =>
  new Headers({ cookie: `${SESSION_COOKIE}=${token}` });
describe("CMS session authorization", () => {
  it("denies anonymous and forged cookies", async () => {
    expect(await resolveCmsAdmin(new Headers())).toBeNull();
    expect(await resolveCmsAdmin(headersFor("forged"))).toBeNull();
  });
  it("denies venue owners", async () => {
    expect(
      await resolveCmsAdmin(headersFor(await signSession(owner))),
    ).toBeNull();
  });
  it("accepts a signed current admin", async () => {
    expect(
      await resolveCmsAdmin(headersFor(await signSession(admin))),
    ).toMatchObject({ id: admin.id, role: "ADMIN" });
  });
  it("denies an admin whose role was revoked", async () => {
    const token = await signSession(admin);
    await prisma.user.update({
      where: { id: admin.id },
      data: { role: "CUSTOMER" },
    });
    expect(await resolveCmsAdmin(headersFor(token))).toBeNull();
    await prisma.user.update({
      where: { id: admin.id },
      data: { role: "ADMIN" },
    });
  });
});
