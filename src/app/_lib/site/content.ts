import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/app/_lib/prisma";

export const getActiveRooms = unstable_cache(
  () =>
    prisma.room.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    }),
  ["active-rooms"],
  { revalidate: 3600, tags: ["rooms"] },
);

export const getPublishedReviews = unstable_cache(
  () =>
    prisma.review.findMany({
      where: { isPublished: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ["published-reviews"],
  { revalidate: 3600, tags: ["reviews"] },
);

function getCachedRoomWithPricing(slug: string) {
  return unstable_cache(
    () =>
      prisma.room.findFirst({
        where: { slug, isActive: true },
        include: { pricingTiers: { orderBy: { minParticipants: "asc" } } },
      }),
    ["room-with-pricing", slug],
    { revalidate: 3600, tags: ["rooms", `room-${slug}`] },
  )();
}

export const getRoomWithPricing = cache(getCachedRoomWithPricing);
