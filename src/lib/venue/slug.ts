import prisma from "@/lib/prisma";

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "venue"
  );
}

/** A unique venue slug derived from `name`, ignoring `excludeId` (the venue itself). */
export async function uniqueVenueSlug(name: string, excludeId?: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  let n = 1;
  while (await prisma.venue.findFirst({ where: { slug, NOT: excludeId ? { id: excludeId } : undefined } })) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return slug;
}
