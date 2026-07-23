import { getRoomImageSrc } from "@/app/_lib/site/room-image";

type RoomImageSource = {
  id: string;
  slug: string;
  imageUpdatedAt: Date | null;
};

type ReviewImageSource = {
  id: string;
  imageUpdatedAt: Date | null;
};

/** URL cover stanza: DB (WebP) oppure fallback statico /public/rooms/{slug}.jpg. */
export function getRoomCoverUrl(room: RoomImageSource): string | null {
  if (room.imageUpdatedAt) {
    return `/api/media/rooms/${room.id}?v=${room.imageUpdatedAt.getTime()}`;
  }
  return getRoomImageSrc(room.slug);
}

export function getReviewCoverUrl(review: ReviewImageSource): string | null {
  if (!review.imageUpdatedAt) {
    return null;
  }
  return `/api/media/reviews/${review.id}?v=${review.imageUpdatedAt.getTime()}`;
}
