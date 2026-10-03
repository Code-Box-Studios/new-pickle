import { AppError } from "@/lib/booking/errors";

/** Explicit temporary preview; never infer this from a failed connection. */
export function isPreviewMode(): boolean {
  return process.env.APP_PREVIEW_MODE === "true";
}

export function assertFullAppEnabled(): void {
  if (isPreviewMode()) {
    throw new AppError("This feature is coming soon. Please check back.", 503, "preview_unavailable");
  }
}
