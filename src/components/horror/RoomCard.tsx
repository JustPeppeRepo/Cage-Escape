import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import { SkullRating } from "@/components/horror/SkullRating";
import type { RoomSummary } from "@/types";

type RoomCardProps = {
  room: RoomSummary;
};

export function RoomCard({ room }: RoomCardProps) {
  const imageSrc = `/rooms/${room.slug}.jpg`;
  const unavailable = !room.isActive;

  // #region agent log
  {
    const absPath = path.join(process.cwd(), "public", "rooms", `${room.slug}.jpg`);
    const fileExists = existsSync(absPath);
    fetch("http://127.0.0.1:7653/ingest/b95a8c87-326d-496a-8bbf-ad6c9410be8d", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "4d555f",
      },
      body: JSON.stringify({
        sessionId: "4d555f",
        runId: "pre-fix",
        hypothesisId: "A",
        location: "RoomCard.tsx:imageSrc",
        message: "Room card image path check",
        data: {
          slug: room.slug,
          imageSrc,
          fileExists,
          isActive: room.isActive,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }
  // #endregion

  const card = (
    <div
      className={`room-card flex h-full flex-col overflow-hidden rounded-md border bg-void-deep shadow-[0_0_20px_rgba(0,0,0,0.6)] transition-shadow ${
        unavailable
          ? "border-blood/50 opacity-90"
          : "hover:animate-glitch-hover border-void-mist hover:shadow-[0_0_30px_rgba(153,0,0,0.4)]"
      }`}
    >
      <div className="relative aspect-16/10 w-full overflow-hidden bg-void">
        <Image
          src={imageSrc}
          alt=""
          fill
          className={`object-cover ${unavailable ? "grayscale-40" : ""}`}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />

        {unavailable ? (
          <>
            {/* Sbarra rossa diagonale */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-10"
            >
              <div className="absolute top-1/2 left-[-20%] h-1 w-[140%] -translate-y-1/2 rotate-[-18deg] bg-blood shadow-[0_0_12px_rgba(153,0,0,0.8)]" />
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
