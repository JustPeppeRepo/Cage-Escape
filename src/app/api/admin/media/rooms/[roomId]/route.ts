import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { optimizeUploadedImage } from "@/app/_lib/media/optimize-image";
import { requireAdmin } from "@/lib/dal";

type RouteContext = {
  params: Promise<{ roomId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  await requireAdmin();

  const { roomId } = await context.params;
  if (!/^[a-z0-9]+$/i.test(roomId) || roomId.length > 64) {
    return NextResponse.json({ error: "Stanza non valida" }, { status: 400 });
  }

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { id: true },
  });
  if (!room) {
    return NextResponse.json({ error: "Stanza non trovata" }, { status: 404 });
  }

  const formData = await request.formData();
  const entry = formData.get("file");
  if (!(entry instanceof File)) {
    return NextResponse.json({ error: "Seleziona un'immagine" }, { status: 400 });
  }

  const optimized = await optimizeUploadedImage(entry, {
    maxWidth: 1400,
    quality: 80,
  });
  if (!optimized.ok) {
    return NextResponse.json({ error: optimized.error }, { status: 400 });
  }

  const updated = await prisma.room.update({
    where: { id: roomId },
    data: {
      imageWebp: new Uint8Array(optimized.webp),
      imageUpdatedAt: new Date(),
    },
    select: { imageUpdatedAt: true },
  });

  revalidatePath("/admin/rooms");
  revalidatePath(`/admin/rooms/${roomId}`);
  revalidatePath("/");
  revalidatePath("/rooms");
  revalidateTag("rooms", "max");

  return NextResponse.json({
    ok: true,
    imageUrl: `/api/media/rooms/${roomId}?v=${updated.imageUpdatedAt!.getTime()}`,
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  await requireAdmin();

  const { roomId } = await context.params;
  if (!/^[a-z0-9]+$/i.test(roomId) || roomId.length > 64) {
    return NextResponse.json({ error: "Stanza non valida" }, { status: 400 });
  }

  await prisma.room.update({
    where: { id: roomId },
    data: { imageWebp: null, imageUpdatedAt: null },
  });

  revalidatePath("/admin/rooms");
  revalidatePath(`/admin/rooms/${roomId}`);
  revalidatePath("/");
  revalidatePath("/rooms");
  revalidateTag("rooms", "max");

  return NextResponse.json({ ok: true });
}
