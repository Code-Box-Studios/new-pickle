import { beforeEach, describe, it, expect } from "vitest";
import { prisma, resetDb } from "../db";
import { requestMagicLink, consumeMagicToken } from "@/lib/auth/magic-link";
import { lastMagicLinks } from "@/lib/email/dev-sender";
import { ValidationError } from "@/lib/booking/errors";

beforeEach(resetDb);

function tokenFromLink(email: string): string {
  const url = new URL(lastMagicLinks.get(email.toLowerCase())!);
  return url.searchParams.get("token")!;
}

describe("magic-link auth", () => {
  it("stores a hashed token and surfaces the link via the dev sender", async () => {
    await requestMagicLink("Player@Example.com");
    const tokens = await prisma.magicLinkToken.findMany();
    expect(tokens).toHaveLength(1);
    expect(tokens[0].tokenHash).toMatch(/^[a-f0-9]{64}$/); // sha256 hex, not the raw token
    expect(lastMagicLinks.get("player@example.com")).toContain("/auth/verify?token=");
  });

  it("creates the user on first request (lightweight accounts)", async () => {
    await requestMagicLink("new@example.com");
    const u = await prisma.user.findUnique({ where: { email: "new@example.com" } });
    expect(u?.role).toBe("CUSTOMER");
  });

  it("consumes a valid token exactly once", async () => {
    await requestMagicLink("p@e.com");
    const raw = tokenFromLink("p@e.com");
    const s = await consumeMagicToken(raw);
    expect(s?.email).toBe("p@e.com");
    expect(await consumeMagicToken(raw)).toBeNull(); // already used
  });

  it("clears the dev banner entry once its token is consumed", async () => {
    await requestMagicLink("banner@e.com");
    expect(lastMagicLinks.has("banner@e.com")).toBe(true);
    await consumeMagicToken(tokenFromLink("banner@e.com"));
    expect(lastMagicLinks.has("banner@e.com")).toBe(false); // banner should disappear after login
  });

  it("leaves the dev banner entry when the token is invalid", async () => {
    await requestMagicLink("keep@e.com");
    await consumeMagicToken("not-a-real-token");
    expect(lastMagicLinks.has("keep@e.com")).toBe(true); // never opened → stays until dismissed
  });

  it("rejects unknown tokens", async () => {
    expect(await consumeMagicToken("not-a-real-token")).toBeNull();
  });

  it("rejects expired tokens", async () => {
    await requestMagicLink("exp@e.com");
    await prisma.magicLinkToken.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await consumeMagicToken(tokenFromLink("exp@e.com"))).toBeNull();
  });

  it("rejects an invalid email", async () => {
    await expect(requestMagicLink("nope")).rejects.toBeInstanceOf(ValidationError);
  });
});
