import { NextResponse } from "next/server";
import { AppError } from "@/lib/booking/errors";

/** Map a thrown error to a JSON response with the right status. */
export function errorResponse(e: unknown): NextResponse {
  if (e instanceof AppError) {
    return NextResponse.json({ error: e.message, code: e.code }, { status: e.httpStatus });
  }
  console.error("[api] unhandled error:", e);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
