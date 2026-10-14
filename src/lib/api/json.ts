import "server-only";
import type { NextRequest } from "next/server";
import { AppError, ValidationError } from "@/lib/booking/errors";

export async function readJsonBody(req: NextRequest): Promise<Record<string, unknown>> {
  const limit = 12000;
  if (Number(req.headers.get("content-length")) > limit) throw new AppError("Request body is too large.", 413, "body_too_large");
  const reader = req.body?.getReader();
  if (!reader) throw new ValidationError("Request body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new AppError("Request body is too large.", 413, "body_too_large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try {
    const body = JSON.parse(Buffer.concat(chunks, size).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid body");
    return body;
  } catch { throw new ValidationError("Send a valid JSON object."); }
}
