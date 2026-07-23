import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { optimizeUploadedImage } from "@/app/_lib/media/optimize-image";
import { requireAdmin } from "@/lib/dal";

type RouteContext = {
  params: Promise<{ reviewId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  await requireAdmin();

  const { reviewId } = await context.params;
  if (!/^[a-z0-9]+$/i.test(reviewId) || reviewId.length > 64) {
    return NextResponse.json({ error: "Recensione non valida" }, { status: 400 });
  }

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { id: true },
  });
  if (!review) {
    return NextResponse.json({ error: "Recensione non trovata" }, { status: 404 });
  }

  const formData = await request.formData();
  const entry = formData.get("file");
  if (!(entry instanceof File)) {
    return NextResponse.json({ error: "Seleziona un'immagine" }, { status: 400 });
  }

  const optimized = await optimizeUploadedImage(entry, {
    maxWidth: 900,
    quality: 78,
  });
  if (!optimized.ok) {
    return NextResponse.json({ error: optimized.error }, { status: 400 });
  }

  const updated = await prisma.review.update({
    where: { id: reviewId },
    data: {
      imageWebp: new Uint8Array(optimized.webp),
      imageUpdatedAt: new Date(),
    },
    select: { imageUpdatedAt: true },
  });

  revalidatePath("/admin/reviews");
  revalidatePath("/");
  revalidateTag("reviews", "max");

  return NextResponse.json({
    ok: true,
    imageUrl: `/api/media/reviews/${reviewId}?v=${updated.imageUpdatedAt!.getTime()}`,
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  await requireAdmin();

  const { reviewId } = await context.params;
  if (!/^[a-z0-9]+$/i.test(reviewId) || reviewId.length > 64) {
    return NextResponse.json({ error: "Recensione non valida" }, { status: 400 });
  }

  await prisma.review.update({
    where: { id: reviewId },
    data: { imageWebp: null, imageUpdatedAt: null },
  });

  revalidatePath("/admin/reviews");
  revalidatePath("/");
  revalidateTag("reviews", "max");

  return NextResponse.json({ ok: true });
}
