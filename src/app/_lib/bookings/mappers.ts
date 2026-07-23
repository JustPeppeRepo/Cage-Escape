import { formatEuroAmount } from "@/app/_lib/bookings/money";
import { getRoomCoverUrl } from "@/app/_lib/media/urls";
import type { RoomSummary } from "@/types";

type RoomLike = {
  id: string;
  slug: string;
  name: string;
  description: string;
  prezzoTotale: { toString(): string };
  prezzoCaparra: { toString(): string };
  durationMinutes: number;
  minPlayers: number;
  maxPlayers: number;
  terrorLevel: number;
  isActive: boolean;
  imageUpdatedAt?: Date | null;
};

export function toRoomSummary(room: RoomLike): RoomSummary {
  return {
    id: room.id,
    slug: room.slug,
    name: room.name,
    description: room.description,
    prezzoTotale: formatEuroAmount(room.prezzoTotale),
    prezzoCaparra: formatEuroAmount(room.prezzoCaparra),
    durationMinutes: room.durationMinutes,
    minPlayers: room.minPlayers,
    maxPlayers: room.maxPlayers,
    terrorLevel: room.terrorLevel,
    isActive: room.isActive,
    imageUrl: getRoomCoverUrl({
      id: room.id,
      slug: room.slug,
      imageUpdatedAt: room.imageUpdatedAt ?? null,
    }),
  };
}
