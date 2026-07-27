import { getRoomImageSrc } from "@/app/_lib/site/room-image";

/** Date da Prisma, oppure stringa ISO dopo unstable_cache (JSON). */
type CacheableDate = Date | string | null;

type RoomImageSource = {
  id: string;
  slug: string;
  imageUpdatedAt: CacheableDate;
};

type ReviewImageSource = {
  id: string;
  imageUpdatedAt: CacheableDate;
};

function toCacheBust(value: CacheableDate): number | null {
  if (!value) {
    return null;
  }
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** URL cover stanza: DB (WebP) oppure fallback statico /public/rooms/{slug}.jpg. */
export function getRoomCoverUrl(room: RoomImageSource): string | null {
  const bust = toCacheBust(room.imageUpdatedAt);
  if (bust != null) {
    return `/api/media/rooms/${room.id}?v=${bust}`;
  }
  return getRoomImageSrc(room.slug);
}

export function getReviewCoverUrl(review: ReviewImageSource): string | null {
  const bust = toCacheBust(review.imageUpdatedAt);
  if (bust == null) {
    return null;
  }
  return `/api/media/reviews/${review.id}?v=${bust}`;
}
