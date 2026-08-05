import { NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { enforceApiRateLimit } from "@/app/_lib/rate-limit";

type RouteContext = {
  params: Promise<{ roomId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  // Anti-DoS: ogni hit carica bytea da Postgres.
  const limited = await enforceApiRateLimit("media-room", 120);
  if (limited) return limited;

  const { roomId } = await context.params;

  if (!/^[a-z0-9]+$/i.test(roomId) || roomId.length > 64) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { imageWebp: true, imageUpdatedAt: true },
  });

  if (!room?.imageWebp || !room.imageUpdatedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(Buffer.from(room.imageWebp), {
    status: 200,
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
