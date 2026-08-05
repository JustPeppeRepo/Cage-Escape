import { NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { enforceApiRateLimit } from "@/app/_lib/rate-limit";

type RouteContext = {
  params: Promise<{ reviewId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const limited = await enforceApiRateLimit("media-review", 120);
  if (limited) return limited;

  const { reviewId } = await context.params;

  if (!/^[a-z0-9]+$/i.test(reviewId) || reviewId.length > 64) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const review = await prisma.review.findFirst({
    where: { id: reviewId, isPublished: true },
    select: {
      imageWebp: true,
      imageUpdatedAt: true,
    },
  });

  if (!review?.imageWebp || !review.imageUpdatedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(Buffer.from(review.imageWebp), {
    status: 200,
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
