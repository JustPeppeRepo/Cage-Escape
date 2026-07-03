import { RoomCard } from "@/components/horror/RoomCard";
import type { RoomSummary } from "@/types";

type RoomsGridProps = {
  rooms: RoomSummary[];
};

export function RoomsGrid({ rooms }: RoomsGridProps) {
  if (rooms.length === 0) {
    return (
      <p className="text-center text-bone/60">
        Nessuna stanza disponibile al momento. Torna a trovarci presto.
      </p>
    );
  }

  return (
    <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
      {rooms.map((room) => (
        <RoomCard key={room.id} room={room} />
      ))}
    </div>
  );
}
