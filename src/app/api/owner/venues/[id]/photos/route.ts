import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { venueMediaStorage } from "@/lib/storage";
import { ValidationError } from "@/lib/booking/errors";
import { requireEditableOwnVenue } from "@/lib/api/owner-venue-access";
import { errorResponse } from "@/lib/http";

// Upload a photo.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await requireEditableOwnVenue(id);
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new ValidationError("Choose an image to upload");
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const { key } = await venueMediaStorage.save({ bytes, contentType: file.type });
    const updated = await prisma.venue.update({
      where: { id },
      data: { photos: { push: `/api/media/${key}` } },
      select: { photos: true },
    });
    return NextResponse.json({ photos: updated.photos });
  } catch (e) {
    return errorResponse(e);
  }
}

// Remove a photo.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { venue } = await requireEditableOwnVenue(id);
    const { photo } = (await req.json()) as { photo?: string };
    const photos = venue.photos.filter((p) => p !== photo);
    await prisma.venue.update({ where: { id }, data: { photos } });
    return NextResponse.json({ photos });
  } catch (e) {
    return errorResponse(e);
  }
}

// Set a photo as the cover (move to front).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { venue } = await requireEditableOwnVenue(id);
    const { photo } = (await req.json()) as { photo?: string };
    if (!photo || !venue.photos.includes(photo)) throw new ValidationError("Unknown photo");
    const photos = [photo, ...venue.photos.filter((p) => p !== photo)];
    await prisma.venue.update({ where: { id }, data: { photos } });
    return NextResponse.json({ photos });
  } catch (e) {
    return errorResponse(e);
  }
}
