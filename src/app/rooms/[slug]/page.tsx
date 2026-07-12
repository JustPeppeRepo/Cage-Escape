import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActiveRooms, getRoomWithPricing } from "@/app/_lib/site/content";
import { toRoomSummary } from "@/app/_lib/bookings/mappers";
import { formatEuroAmount } from "@/app/_lib/bookings/money";
import { SkullRating } from "@/components/horror/SkullRating";
import { BookingWidget } from "@/components/horror/booking/BookingWidgetLoader";

export const revalidate = 3600;

type RoomDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const rooms = await getActiveRooms();
  return rooms.map((room) => ({ slug: room.slug }));
}

export async function generateMetadata({
  params,
}: RoomDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const room = await getRoomWithPricing(slug);

  if (!room) {
    return { title: "Stanza non trovata | Cage Room" };
  }

  return {
    title: `${room.name} | Cage Room`,
    description: room.description,
    alternates: {
      canonical: `/rooms/${slug}`,
    },
    openGraph: {
      title: `${room.name} | Cage Room`,
      description: room.description,
      url: `/rooms/${slug}`,
    },
  };
}

export default async function RoomDetailPage({
  params,
}: RoomDetailPageProps) {
  const { slug } = await params;
  const room = await getRoomWithPricing(slug);

  if (!room) {
    notFound();
  }

  const roomSummary = toRoomSummary(room);
  const pricingTiers = room.pricingTiers.map((tier) => ({
    minParticipants: tier.minParticipants,
    maxParticipants: tier.maxParticipants,
    totalPrice: formatEuroAmount(tier.totalPrice),
    depositPrice: formatEuroAmount(tier.depositPrice),
  }));

  return (
    <main className="min-h-screen bg-void px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto flex max-w-4xl flex-col gap-10">
        <header className="flex flex-col gap-4 border-b border-void-mist pb-8">
          <h1 className="font-heading text-4xl text-blood-bright sm:text-5xl">
            {roomSummary.name}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-bone/80">
            <span>{roomSummary.durationMinutes} min</span>
            <span>
              {roomSummary.minPlayers}-{roomSummary.maxPlayers} giocatori
            </span>
            <span>A partire da {roomSummary.prezzoTotale} €</span>
            <SkullRating level={roomSummary.terrorLevel} />
          </div>
          <p className="text-bone/70">{roomSummary.description}</p>
        </header>

        <BookingWidget
          room={{
            id: room.id,
            slug: roomSummary.slug,
            minPlayers: roomSummary.minPlayers,
            maxPlayers: roomSummary.maxPlayers,
            durationMinutes: roomSummary.durationMinutes,
          }}
          pricingTiers={pricingTiers}
        />
      </div>
    </main>
  );
}
