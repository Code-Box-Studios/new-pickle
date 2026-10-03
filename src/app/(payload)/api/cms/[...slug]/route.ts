import config from "@payload-config";
import { NextResponse } from "next/server";
import { isPreviewMode } from "@/lib/deployment";
import {
  REST_DELETE,
  REST_GET,
  REST_OPTIONS,
  REST_PATCH,
  REST_POST,
  REST_PUT,
} from "@payloadcms/next/routes";
function available(handler: ReturnType<typeof REST_GET>) {
  return async (...args: Parameters<typeof handler>) => {
    if (isPreviewMode()) return NextResponse.json(
      { error: "This feature is coming soon.", code: "preview_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
    return handler(...args);
  };
}
export const GET = available(REST_GET(config));
export const POST = available(REST_POST(config));
export const DELETE = available(REST_DELETE(config));
export const PATCH = available(REST_PATCH(config));
export const PUT = available(REST_PUT(config));
export const OPTIONS = available(REST_OPTIONS(config));
