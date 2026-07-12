import Link from "next/link";
import { SkullRating } from "@/components/horror/SkullRating";
import type { RoomSummary } from "@/types";

type RoomCardProps = {
  room: RoomSummary;
};

export function RoomCard({ room }: RoomCardProps) {
  return (
    <Link href={`/rooms/${room.slug}`} className="block">
      <div className="room-card hover:animate-glitch-hover flex h-full flex-col gap-3 rounded-md border border-void-mist bg-void-deep p-6 shadow-[0_0_20px_rgba(0,0,0,0.6)] transition-shadow hover:shadow-[0_0_30px_rgba(153,0,0,0.4)]">
        <h3 className="font-heading text-2xl text-blood-bright">
          {room.name}
        </h3>
        <p className="flex-1 text-sm text-bone/70">{room.description}</p>

        <div className="flex items-center justify-between border-t border-void-mist pt-3 text-sm text-bone/80">
          <span>{room.durationMinutes} min</span>
          <span>
            {room.minPlayers}-{room.maxPlayers} giocatori
          </span>
        </div>

        <div className="flex items-center justify-between">
          <SkullRating level={room.terrorLevel} />
          <span className="text-lg font-semibold text-ectoplasm">
            {room.prezzoTotale} €
          </span>
        </div>
      </div>
    </Link>
  );
}
