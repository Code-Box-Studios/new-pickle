import { NextRequest, NextResponse } from "next/server";
import { requestMagicLink } from "@/lib/auth/magic-link";
import { errorResponse } from "@/lib/http";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: unknown; next?: unknown };
    await requestMagicLink(String(body.email ?? ""), { origin: req.nextUrl.origin, next: body.next });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
