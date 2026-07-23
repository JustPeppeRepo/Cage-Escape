import Image from "next/image";
import Link from "next/link";
import { SkullRating } from "@/components/horror/SkullRating";
import type { RoomSummary } from "@/types";

type RoomCardProps = {
  room: RoomSummary;
  /** Imposta priority/eager per l'immagine above-the-fold (LCP). */
  priority?: boolean;
};

export function RoomCard({ room, priority = false }: RoomCardProps) {
  const imageSrc = room.imageUrl;
  const unavailable = !room.isActive;

  const card = (
    <div
      className={`room-card flex h-full flex-col overflow-hidden rounded-md border bg-void-deep shadow-[0_0_20px_rgba(0,0,0,0.6)] transition-shadow ${
        unavailable
          ? "border-blood/50 opacity-90"
          : "hover:animate-glitch-hover border-void-mist hover:shadow-[0_0_30px_rgba(133,32,38,0.4)]"
      }`}
    >
      <div className="relative aspect-16/10 w-full overflow-hidden bg-void">
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt=""
            fill
            unoptimized
            priority={priority}
            className={`object-cover ${unavailable ? "grayscale-40" : ""}`}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div
            aria-hidden
            className={`absolute inset-0 bg-linear-to-br from-void via-void-deep to-blood/20 ${unavailable ? "grayscale-40" : ""}`}
          />
        )}

        {unavailable ? (
          <>
            {/* Sbarra rossa diagonale */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-10"
            >
              <div className="absolute top-1/2 left-[-20%] h-1 w-[140%] -translate-y-1/2 rotate-[-18deg] bg-blood shadow-[0_0_12px_rgba(133,32,38,0.8)]" />
            </div>
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-void/55">
              <span className="border border-blood bg-void-deep/90 px-4 py-2 font-heading text-sm tracking-[0.2em] text-blood-bright uppercase sm:text-base">
                Coming Soon
              </span>
            </div>
          </>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-6">
        <h3 className="font-heading text-2xl text-blood-bright">{room.name}</h3>
        <p className="flex-1 text-sm text-bone/70">{room.description}</p>

        <div className="flex items-center justify-between border-t border-void-mist pt-3 text-sm text-bone/80">
          <span>{room.durationMinutes} min</span>
          <span>
            {room.minPlayers}-{room.maxPlayers} giocatori
          </span>
        </div>

        <div className="flex items-center justify-between">
          <SkullRating level={room.terrorLevel} />
          {unavailable ? (
            <span className="text-sm font-semibold tracking-wide text-blood-bright uppercase">
              Non disponibile
            </span>
          ) : (
            <span className="text-lg font-semibold text-ectoplasm">
              {room.prezzoTotale} €
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (unavailable) {
    return (
      <div
        className="block cursor-not-allowed"
        aria-disabled="true"
        title="Stanza non ancora disponibile"
      >
        {card}
      </div>
    );
  }

  return (
    <Link href={`/rooms/${room.slug}`} className="block">
      {card}
    </Link>
  );
}
