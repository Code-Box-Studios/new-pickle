import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { resolveCmsAdmin } from "@/cms/auth";

const identities = vi.hoisted(() => new Map<string, { id: string }>());
vi.mock("@supabase/ssr", async importOriginal => {
  const original = await importOriginal<typeof import("@supabase/ssr")>();
  return { ...original, createServerClient: (_url: string, _key: string, options: { cookies: { getAll(): { name: string; value: string }[] } }) => ({ auth: { getUser: async () => ({ data: { user: identities.get(options.cookies.getAll().find(cookie => cookie.name === "pikol-test-session")?.value ?? "") ?? null }, error: null }) } }) };
});
const emails = [
  "cms-admin-test@rallypoint.test",
  "cms-owner-test@rallypoint.test",
];
  let admin: { id: string; email: string | null; role: "ADMIN" };
beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  const a = await prisma.user.create({
    data: { email: emails[0], role: "ADMIN", supabaseId: "verified-admin" },
  });
  await prisma.user.create({
    data: { email: emails[1], role: "OWNER", supabaseId: "verified-owner" },
  });
  admin = { ...a, role: "ADMIN" };
  identities.set("verified-admin", { id: "verified-admin" });
  identities.set("verified-owner", { id: "verified-owner" });
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
});
const headersFor = (token: string) =>
  new Headers({ cookie: `pikol-test-session=${token}` });
describe("CMS session authorization", () => {
  it("denies anonymous and forged cookies", async () => {
    expect(await resolveCmsAdmin(new Headers())).toBeNull();
    expect(await resolveCmsAdmin(headersFor("forged"))).toBeNull();
  });
  it("denies venue owners", async () => {
    expect(
      await resolveCmsAdmin(headersFor("verified-owner")),
    ).toBeNull();
  });
  it("accepts a provider-verified current admin", async () => {
    expect(
      await resolveCmsAdmin(headersFor("verified-admin")),
    ).toMatchObject({ id: admin.id, role: "ADMIN" });
  });
  it("denies an admin whose role was revoked", async () => {
    const token = "verified-admin";
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
