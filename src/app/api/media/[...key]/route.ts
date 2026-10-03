import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { venueMediaStorage } from "@/lib/storage";
import { canViewVenueMedia, venueForMediaKey } from "@/lib/venue/media-access";
import { isPreviewMode } from "@/lib/deployment";

/**
 * Serve venue media. Live venues → public + cacheable. Unpublished venues →
 * owner/staff/admin only (preview). Unrelated request → 404 (not 403), so the
 * existence of an unpublished venue's media isn't leaked.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  if (isPreviewMode()) return NextResponse.json(
    { error: "This feature is coming soon.", code: "preview_unavailable" },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
  const key = (await params).key.join("/");
  const venue = await venueForMediaKey(key);
  if (!venue) return new NextResponse("Not found", { status: 404 });

  const session = await getSession();
  const allowed = await canViewVenueMedia(venue, session);
  if (!allowed) return new NextResponse("Not found", { status: 404 });

  try {
    const { bytes, contentType } = await venueMediaStorage.getBytes(key);
    const cache =
      venue.isPublished && venue.status === "APPROVED"
        ? "public, max-age=3600"
        : "private, no-store";
    return new NextResponse(new Uint8Array(bytes), {
      headers: { "Content-Type": contentType, "Cache-Control": cache },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
