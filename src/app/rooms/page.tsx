import type { Metadata } from "next";
import { prisma } from "@/app/_lib/prisma";
import { toRoomSummary } from "@/app/_lib/bookings/mappers";
import { RoomsGrid } from "@/components/horror/RoomsGrid";
import { SectionHeading } from "@/components/ui/SectionHeading";

export const metadata: Metadata = {
  title: "Le nostre stanze horror | Cage Room",
  description:
    "Scopri tutte le escape room a tema horror di Cage Room. Scegli la tua stanza e prenota online in pochi minuti.",
};

export default async function RoomsPage() {
  const rooms = await prisma.room.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });
  const roomSummaries = rooms.map(toRoomSummary);

  return (
    <main className="min-h-screen bg-void px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow="Scegli il tuo destino" title="Le nostre stanze" />
        <RoomsGrid rooms={roomSummaries} />
      </div>
    </main>
  );
}
