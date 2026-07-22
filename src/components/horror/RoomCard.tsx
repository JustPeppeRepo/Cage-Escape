import Image from "next/image";
import Link from "next/link";
import { SkullRating } from "@/components/horror/SkullRating";
import type { RoomSummary } from "@/types";

type RoomCardProps = {
  room: RoomSummary;
};

export function RoomCard({ room }: RoomCardProps) {
  const imageSrc = `/rooms/${room.slug}.jpg`;

  return (
    <Link href={`/rooms/${room.slug}`} className="block">
      <div className="room-card hover:animate-glitch-hover flex h-full flex-col overflow-hidden rounded-md border border-void-mist bg-void-deep shadow-[0_0_20px_rgba(0,0,0,0.6)] transition-shadow hover:shadow-[0_0_30px_rgba(153,0,0,0.4)]">
        <div className="relative aspect-16/10 w-full overflow-hidden bg-void">
          <Image
            src={imageSrc}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </div>

        <div className="flex flex-1 flex-col gap-3 p-6">
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
      </div>
    </Link>
  );
}
