import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { readJsonBody } from "@/lib/api/json";
import { requireUser } from "@/lib/auth/guards";
import { assertPhoneOrigin } from "@/lib/auth/phone-origin";
import { assertFullAppEnabled } from "@/lib/deployment";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/booking/errors";
import { errorResponse } from "@/lib/http";
import { createListing, claimListing, withdrawListing, markPaymentSent, transferTrade, releaseTrade, postMessage } from "./service";
import { marketListings, myPasalo, publicListing, tradeThread, sellerConversations } from "./read";
import type { CreateListingInput } from "./types";

export function pasaloJson(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
}


function validatePath(path: string[]) {
  if (path.length > 3 || path.some(p => !/^[a-zA-Z0-9_-]{1,100}$/.test(p))) throw new NotFoundError();
}

export async function readPasalo(req: NextRequest, path: string[] = []) {
  try {
    assertFullAppEnabled();
    validatePath(path);
    if (!path.length) return pasaloJson({ listings: await marketListings(req.nextUrl.searchParams.get("city") || undefined) });
    if (path.length === 1 && path[0] === "mine") {
      const s = await requireUser();
      return pasaloJson(await myPasalo(s.id));
    }
    if (path.length === 2 && path[0] === "trades") {
      const s = await requireUser();
      return pasaloJson(await tradeThread(s.id, path[1], req.nextUrl.searchParams.get("before") || undefined));
    }
    if (path.length === 2 && path[1] === "conversations") {
      const s = await requireUser();
      return pasaloJson(await sellerConversations(s.id, path[0], req.nextUrl.searchParams.get("before") || ""));
    }
    if (path.length === 1) {
      // Public offer details remain visible before sign-in; participant extras are scoped.
      const { getSession } = await import("@/lib/auth/session");
      const s = await getSession();
      return pasaloJson(await publicListing(path[0], s?.id));
    }
    throw new NotFoundError();
  } catch (e) { return errorResponse(e); }
}

export async function mutatePasalo(req: NextRequest, path: string[] = []) {
  try {
    assertFullAppEnabled();
    validatePath(path);
    if (!req.headers.get("origin")) throw new ForbiddenError("Open Pikol directly to manage Pasalo.");
    assertPhoneOrigin(req);
    const s = await requireUser();
    const body = await readJsonBody(req);
    if (!path.length) return pasaloJson(await createListing(s.id, body as unknown as CreateListingInput), 201);
    if (path.length === 2 && path[1] === "claim") {
      const claim = await claimListing(s.id, path[0], { customerName: body.customerName as string, customerMobile: body.customerMobile as string });
      return pasaloJson({ tradeId: claim.id }, 201);
    }
    if (path.length === 2 && path[1] === "withdraw") {
      await withdrawListing(s.id, path[0]); return pasaloJson({ ok: true });
    }
    if (path.length === 3 && path[0] === "trades") {
      const id = path[1];
      switch (path[2]) {
        case "messages": await postMessage(s.id, id, body.body); break;
        case "payment":
          if (body.sent !== true) throw new ValidationError("Confirm you sent payment before continuing.");
          await markPaymentSent(s.id, id, body.reference as string | undefined); break;
        case "transfer":
          if (body.received !== true) throw new ValidationError("Check your wallet and confirm you received the payment.");
          await transferTrade(s.id, id); break;
        case "release":
          if (body.notPaid !== true) throw new ValidationError("Confirm you have not sent payment.");
          await releaseTrade(s.id, id); break;
        default: throw new NotFoundError();
      }
      return pasaloJson({ ok: true });
    }
    throw new NotFoundError();
  } catch (e) { return errorResponse(e); }
}
