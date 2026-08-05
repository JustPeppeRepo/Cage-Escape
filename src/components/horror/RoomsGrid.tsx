import { RoomCard } from "@/components/horror/RoomCard";
import type { RoomSummary } from "@/types";

type RoomsGridProps = {
  rooms: RoomSummary[];
  headingLevel?: "h2" | "h3";
};

export function RoomsGrid({ rooms, headingLevel = "h3" }: RoomsGridProps) {
  if (rooms.length === 0) {
    return (
      <p className="text-center text-bone/60">
        Nessuna stanza disponibile al momento. Torna a trovarci presto.
      </p>
    );
  }

  const lcpSlug = rooms.find((room) => room.isActive)?.slug ?? rooms[0]?.slug;

  return (
    <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {rooms.map((room) => (
        <RoomCard
          key={room.id}
          room={room}
          priority={room.slug === lcpSlug}
          headingLevel={headingLevel}
        />
      ))}
    </div>
  );
}
