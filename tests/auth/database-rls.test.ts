import { beforeEach, describe, expect, it } from "vitest";
import { prisma, resetDb } from "../db";
import { randomUUID } from "node:crypto";
beforeEach(resetDb);

describe("Supabase database privacy", () => {
  it("hides application rows from an unprivileged API role", async () => {
    await prisma.user.create({ data: { email: "private@example.com", role: "ADMIN" } });
    const role = `pikol_test_${randomUUID().replaceAll("-", "")}`;
    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe(`CREATE ROLE "${role}" NOLOGIN`);
      await tx.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO "${role}"`);
      await tx.$executeRawUnsafe(`GRANT SELECT ON public.users, public.phone_challenges TO "${role}"`);
      await tx.$executeRawUnsafe(`SET LOCAL ROLE "${role}"`);
      expect(await tx.$queryRaw`SELECT email FROM public.users`).toEqual([]);
      expect(await tx.$queryRaw`SELECT * FROM public.phone_challenges`).toEqual([]);
      await tx.$executeRawUnsafe("RESET ROLE");
      await tx.$executeRawUnsafe(`DROP OWNED BY "${role}"`);
      await tx.$executeRawUnsafe(`DROP ROLE "${role}"`);
    });
    expect(await prisma.user.count()).toBe(1);
  });
});
