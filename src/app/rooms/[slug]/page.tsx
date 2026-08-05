/**
 * Dettaglio stanza `/rooms/[slug]`
 *
 * @description Info stanza, terror level e widget prenotazione (calendario/hold).
 * @components StarRating, BookingWidget (dynamic)
 * @data getRoomWithPricing, generateStaticParams ← getActiveRooms
 * @actions getAvailableSlots, getMonthClosedDates, holdSlot (via BookingWidget)
 * @seo generateMetadata + OG image cover
 */
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { getActiveRooms, getRoomWithPricing } from "@/app/_lib/site/content";
import { toRoomSummary } from "@/app/_lib/bookings/mappers";
import { formatEuroAmount } from "@/app/_lib/bookings/money";
import { getRoomCoverUrl } from "@/app/_lib/media/urls";
import { SITE_NAME } from "@/app/_lib/site/seo";
import { StarRating } from "@/components/horror/StarRating";

const BookingWidget = dynamic(
  () =>
    import("@/components/horror/booking/BookingWidget").then(
      (mod) => mod.BookingWidget,
    ),
  {
    loading: () => (
      <div
        className="h-96 animate-pulse rounded-md border border-void-mist bg-void-deep"
        aria-hidden
      />
    ),
  },
);

export const revalidate = 3600;

type RoomDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  try {
    const rooms = await getActiveRooms();
    return rooms.map((room) => ({ slug: room.slug }));
  } catch {
    // Build senza DB raggiungibile (es. Neon in sleep/timeout): le pagine
    // restano on-demand invece di far fallire `next build`.
    return [];
  }
}

export async function generateMetadata({
  params,
}: RoomDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const room = await getRoomWithPricing(slug);

  if (!room) {
    return { title: "Stanza non trovata" };
  }

  const isHorrorRoom = room.terrorLevel >= 4;
  const roomLabel = isHorrorRoom ? "escape room horror" : "escape room";
  const title = `${room.name} — ${roomLabel}`;
  const coverUrl = getRoomCoverUrl(room);
  const ogImages = coverUrl ? [{ url: coverUrl, alt: room.name }] : undefined;

  return {
    title,
    description: room.description,
    alternates: {
      canonical: `/rooms/${slug}`,
    },
    openGraph: {
      title: `${room.name} | ${SITE_NAME}`,
      description: room.description,
      url: `/rooms/${slug}`,
      type: "website",
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title: `${room.name} | ${SITE_NAME}`,
      description: room.description,
      images: coverUrl ? [coverUrl] : undefined,
    },
  };
}

export default async function RoomDetailPage({
  params,
}: RoomDetailPageProps) {
  const { slug } = await params;

  // Evita che /rooms/foo.jpg (file assente in public/) venga trattato come slug
  // e restituisca HTML 200 a next/image.
  if (/\.(jpe?g|png|webp|gif|svg)$/i.test(slug)) {
    notFound();
  }

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
    <main
      id="main-content"
      className="min-h-screen bg-void px-4 py-16 sm:px-6 sm:py-24"
    >
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
            <StarRating level={roomSummary.terrorLevel} />
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
