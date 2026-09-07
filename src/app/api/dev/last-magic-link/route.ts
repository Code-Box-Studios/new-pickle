import { NextResponse } from "next/server";
import { lastMagicLinks } from "@/lib/email/dev-sender";

// Dev-only helper so the login banner can surface the latest magic link
// without SMTP. 404s in production.
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }
  const links = Array.from(lastMagicLinks.entries()).map(([email, url]) => ({
    email,
    url,
  }));
  return NextResponse.json({ links });
}
