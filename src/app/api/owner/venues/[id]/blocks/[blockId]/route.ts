import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { NotFoundError } from "@/lib/booking/errors";
import { requireOwnVenue } from "@/lib/api/owner-venue-access";
import { removeBlock } from "@/lib/venue/blocks";
import { errorResponse } from "@/lib/http";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; blockId: string }> },
) {
  try {
    const { id, blockId } = await params;
    await requireOwnVenue(id);
    const ex = await prisma.scheduleException.findUnique({ where: { id: blockId } });
    if (!ex || ex.venueId !== id) throw new NotFoundError("Block not found");
    await removeBlock(blockId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
