import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/app/_lib/prisma";
import { requireAdmin } from "@/lib/dal";
import { formatEuroAmount } from "@/app/_lib/bookings/money";
import { DeleteRoomButton } from "@/components/admin/DeleteRoomButton";
import { PricingTierManager } from "@/components/admin/PricingTierManager";
import { RoomForm } from "@/components/admin/RoomForm";

type AdminEditRoomPageProps = {
  params: Promise<{ roomId: string }>;
};

export async function generateMetadata({
  params,
}: AdminEditRoomPageProps): Promise<Metadata> {
  const { roomId } = await params;
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  return {
    title: room ? `${room.name} | Admin` : "Stanza | Admin",
    robots: { index: false, follow: false },
  };
}

export default async function AdminEditRoomPage({
  params,
}: AdminEditRoomPageProps) {
  await requireAdmin();
  const { roomId } = await params;

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      pricingTiers: { orderBy: { minParticipants: "asc" } },
    },
  });

  if (!room) {
    notFound();
  }

  return (
    <main>
      <Link href="/admin/rooms" className="text-sm text-bone/60 hover:text-bone">
        ← Torna alle stanze
      </Link>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl text-blood-bright">
        {room.name}
      </h1>

      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="mb-4 text-lg text-bone">Dettagli stanza</h2>
          <RoomForm
            room={{
              id: room.id,
              slug: room.slug,
              name: room.name,
              description: room.description,
              prezzoTotale: formatEuroAmount(room.prezzoTotale),
              prezzoCaparra: formatEuroAmount(room.prezzoCaparra),
              durationMinutes: room.durationMinutes,
              minPlayers: room.minPlayers,
              maxPlayers: room.maxPlayers,
              terrorLevel: room.terrorLevel,
              isActive: room.isActive,
            }}
          />
          <DeleteRoomButton roomId={room.id} />
        </div>

        <div>
          <PricingTierManager
            roomId={room.id}
            tiers={room.pricingTiers.map((tier) => ({
              id: tier.id,
              minParticipants: tier.minParticipants,
              maxParticipants: tier.maxParticipants,
              totalPrice: formatEuroAmount(tier.totalPrice),
              depositPrice: formatEuroAmount(tier.depositPrice),
            }))}
          />
        </div>
      </div>
    </main>
  );
}
