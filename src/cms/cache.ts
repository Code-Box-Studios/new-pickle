import { revalidateTag } from "next/cache";
import type { GlobalAfterChangeHook } from "payload";

export const PUBLIC_CONTENT_TAG = "published-cms-content";

/** Expire public content on edits, including publishing and unpublishing. */
export const revalidatePublicContent: GlobalAfterChangeHook = async ({ doc, req }) => {
  try {
    // Expire immediately so unpublishing cannot serve the previous public copy.
    // Next flushes invalidation when the request ends, after Payload commits.
    revalidateTag(PUBLIC_CONTENT_TAG, { expire: 0 });
  } catch (error) {
    // Seeds and migrations can use Payload's local API without a Next request.
    // Their changes are picked up by the bounded cache lifetime instead.
    if (
      req.payloadAPI === "local" &&
      error instanceof Error &&
      error.message.startsWith("Invariant: static generation store missing in")
    ) return doc;
    throw error;
  }
  return doc;
};
