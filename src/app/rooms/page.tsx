/**
 * Catalogo stanze `/rooms`
 *
 * @description Griglia di tutte le stanze pubbliche (attive e coming soon).
 * @components SectionHeading, RoomsGrid → RoomCard
 * @data getPublicRooms, toRoomSummary
 * @seo metadata + openGraph / twitter
 */
import type { Metadata } from "next";
import { getPublicRooms } from "@/app/_lib/site/content";
import { toRoomSummary } from "@/app/_lib/bookings/mappers";
import { RoomsGrid } from "@/components/horror/RoomsGrid";
import { SectionHeading } from "@/components/ui/SectionHeading";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Stanze escape room",
  description:
    "Scopri le escape room di Cage Escape Room: temi diversi, dall'avventura all'horror. Scegli la stanza e prenota online in pochi minuti.",
  alternates: { canonical: "/rooms" },
  openGraph: {
    title: "Stanze escape room | Cage Escape Room",
    description:
      "Scopri le escape room di Cage Escape Room: temi diversi, dall'avventura all'horror. Scegli la stanza e prenota online.",
    url: "/rooms",
  },
  twitter: {
    card: "summary_large_image",
    title: "Stanze escape room | Cage Escape Room",
    description:
      "Scopri le escape room di Cage Escape Room: temi diversi, dall'avventura all'horror. Scegli la stanza e prenota online.",
  },
};

export default async function RoomsPage() {
  const rooms = await getPublicRooms();
  const roomSummaries = rooms.map(toRoomSummary);

  return (
    <main
      id="main-content"
      className="min-h-screen bg-void px-4 py-16 sm:px-6 sm:py-24"
    >
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          as="h1"
          eyebrow="Scegli la tua storia"
          title="Le nostre stanze"
        />
        <RoomsGrid rooms={roomSummaries} headingLevel="h2" />
      </div>
    </main>
  );
}
