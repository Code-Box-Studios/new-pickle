import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/auth/verify/route";

afterEach(() => vi.unstubAllEnvs());
it("keeps the booking return path and shows a friendly error when Google is cancelled", async () => {
  const response = await GET(new NextRequest("http://localhost:3000/auth/verify?provider=google&error=access_denied&error_description=private-provider-details&next=%2Fbook%2FABC"));
  expect(response.headers.get("location")).toBe("http://localhost:3000/login?error=oauth&next=%2Fbook%2FABC#");
  expect(response.cookies.getAll()).toHaveLength(0);
  expect(response.headers.get("location")).not.toContain("private-provider-details");
  expect(response.headers.get("cache-control")).toContain("no-store");
});
