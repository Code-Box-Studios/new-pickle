import { beforeEach, describe, expect, it } from "vitest";
import type { User } from "@supabase/supabase-js";
import { prisma, resetDb } from "../db";
import { resolveSupabaseUser } from "@/lib/auth/supabase-user";

beforeEach(resetDb);
function identity(fields: Partial<User> = {}): User {
  return { id: "auth-player", aud: "authenticated", app_metadata: {}, user_metadata: { role: "ADMIN" }, created_at: new Date().toISOString(), email: "player@example.com", email_confirmed_at: new Date().toISOString(), ...fields };
}

describe("verified Supabase identity binding", () => {
  it("preserves existing account IDs, roles, and ownership", async () => {
    const existing = await prisma.user.create({ data: { email: "player@example.com", role: "OWNER" } });
    const session = await resolveSupabaseUser(identity());
    expect(session).toMatchObject({ id: existing.id, role: "OWNER" });
    expect(await prisma.user.count()).toBe(1);
  });
  it("creates only customers even when user metadata requests admin", async () => {
    expect(await resolveSupabaseUser(identity())).toMatchObject({ email: "player@example.com", role: "CUSTOMER" });
  });
  it("rejects unverified email, phone, and anonymous identities", async () => {
    expect(await resolveSupabaseUser(identity({ email_confirmed_at: undefined }))).toBeNull();
    expect(await resolveSupabaseUser(identity({ email: undefined, email_confirmed_at: undefined, phone: "639171234567" }))).toBeNull();
    expect(await resolveSupabaseUser(identity({ is_anonymous: true }))).toBeNull();
    expect(await prisma.user.count()).toBe(0);
  });
  it("does not link a booking contact number to a privileged account", async () => {
    const owner = await prisma.user.create({ data: { email: "owner@example.com", mobile: "09171234567", role: "OWNER" } });
    const user = await resolveSupabaseUser(identity({ email: undefined, email_confirmed_at: undefined, phone: "639171234567", phone_confirmed_at: new Date().toISOString() }));
    expect(user?.id).not.toBe(owner.id);
    expect(user).toMatchObject({ mobile: "+639171234567", role: "CUSTOMER" });
  });
  it("refuses to merge verified identifiers belonging to different accounts", async () => {
    await prisma.user.create({ data: { email: "player@example.com", role: "ADMIN" } });
    await prisma.user.create({ data: { verifiedMobile: "+639171234567" } });
    await expect(resolveSupabaseUser(identity({ phone: "639171234567", phone_confirmed_at: new Date().toISOString() }))).rejects.toMatchObject({ httpStatus: 409 });
  });
  it("refuses an identity already bound to another Supabase account", async () => {
    await prisma.user.create({ data: { email: "player@example.com", supabaseId: "different-auth" } });
    await expect(resolveSupabaseUser(identity())).rejects.toMatchObject({ httpStatus: 409 });
  });
  it("rejects inactive accounts", async () => {
    await prisma.user.create({ data: { email: "player@example.com", isActive: false } });
    expect(await resolveSupabaseUser(identity())).toBeNull();
  });
  it("serializes concurrent first sign-ins without creating duplicate users", async () => {
    const users = await Promise.all([resolveSupabaseUser(identity()), resolveSupabaseUser(identity())]);
    expect(users[0]?.id).toBe(users[1]?.id);
    expect(await prisma.user.count()).toBe(1);
  });
});
