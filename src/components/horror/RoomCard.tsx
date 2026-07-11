"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { SkullRating } from "@/components/horror/SkullRating";
import type { RoomSummary } from "@/types";

type RoomCardProps = {
  room: RoomSummary;
};

const TILT_RANGE_DEGREES = 10;

export function RoomCard({ room }: RoomCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const pointerX = useMotionValue(0.5);
  const pointerY = useMotionValue(0.5);

  const springConfig = { stiffness: 150, damping: 20 };
  const rotateX = useSpring(
    useTransform(pointerY, [0, 1], [TILT_RANGE_DEGREES, -TILT_RANGE_DEGREES]),
    springConfig,
  );
  const rotateY = useSpring(
    useTransform(pointerX, [0, 1], [-TILT_RANGE_DEGREES, TILT_RANGE_DEGREES]),
    springConfig,
  );

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const bounds = cardRef.current?.getBoundingClientRect();
    if (!bounds) return;

    pointerX.set((event.clientX - bounds.left) / bounds.width);
    pointerY.set((event.clientY - bounds.top) / bounds.height);
  }

  function handlePointerLeave() {
    pointerX.set(0.5);
    pointerY.set(0.5);
  }

  return (
    <Link href={`/rooms/${room.slug}`} className="block">
      <motion.div
        ref={cardRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        style={{ rotateX, rotateY, transformPerspective: 800 }}
        className="hover:animate-glitch-hover flex h-full flex-col gap-3 rounded-md border border-void-mist bg-void-deep p-6 shadow-[0_0_20px_rgba(0,0,0,0.6)] transition-shadow hover:shadow-[0_0_30px_rgba(153,0,0,0.4)]"
      >
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
      </motion.div>
    </Link>
  );
}
