import { NextResponse } from "next/server";
import { prisma } from "@/app/_lib/prisma";
import { requireAdmin } from "@/lib/dal";
import { sanitizeWaiverFileName } from "@/app/_lib/bookings/waiver-upload";

type RouteContext = {
  params: Promise<{ waiverId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  await requireAdmin();

  const { waiverId } = await context.params;

  if (!/^[a-z0-9]+$/i.test(waiverId) || waiverId.length > 64) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const waiver = await prisma.bookingWaiver.findUnique({
    where: { id: waiverId },
    select: {
      fileName: true,
      mimeType: true,
      content: true,
    },
  });

  if (!waiver) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const safeFileName = sanitizeWaiverFileName(waiver.fileName);

  return new NextResponse(waiver.content, {
    status: 200,
    headers: {
      "Content-Type": waiver.mimeType,
      "Content-Disposition": `attachment; filename="${safeFileName}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
