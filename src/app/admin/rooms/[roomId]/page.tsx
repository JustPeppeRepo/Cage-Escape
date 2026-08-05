/**
 * Modifica stanza `/admin/rooms/[roomId]`
 *
 * @description Edit stanza, fasce prezzo, media cover, delete.
 * @components RoomForm, PricingTierManager, DeleteRoomButton, MediaUploadField
 * @actions upsertRoom, upsertPricingTier, deleteRoom; API media rooms
 * @auth requireAdmin
 * @seo noindex (titolo statico anti-leak)
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/app/_lib/prisma";
import { requireAdmin } from "@/lib/dal";
import { formatEuroAmount } from "@/app/_lib/bookings/money";
import { getRoomCoverUrl } from "@/app/_lib/media/urls";
import { DeleteRoomButton } from "@/components/admin/DeleteRoomButton";
import { PricingTierManager } from "@/components/admin/PricingTierManager";
import { RoomForm } from "@/components/admin/RoomForm";

type AdminEditRoomPageProps = {
  params: Promise<{ roomId: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  // Titolo statico, senza leggere dati dal DB: il middleware verifica solo
  // la presenza del cookie di sessione (non il ruolo), quindi un utente
  // loggato ma non admin puo' comunque far eseguire questa funzione prima
  // che requireAdmin() nel corpo della pagina blocchi l'accesso. Leggere il
  // nome della stanza qui farebbe trapelare quel dato nel tag <title> anche
  // a chi non e' autorizzato a vedere la pagina.
  return {
    title: "Stanza | Admin",
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
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      prezzoTotale: true,
      prezzoCaparra: true,
      durationMinutes: true,
      minPlayers: true,
      maxPlayers: true,
      terrorLevel: true,
      isActive: true,
      imageUpdatedAt: true,
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
      <h1 className="mt-4 font-heading text-3xl text-blood-bright">
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
              imageUrl: getRoomCoverUrl(room),
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
