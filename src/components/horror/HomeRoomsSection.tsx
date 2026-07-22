import { getPublicRooms } from "@/app/_lib/site/content";
import { toRoomSummary } from "@/app/_lib/bookings/mappers";
import { RoomsGrid } from "@/components/horror/RoomsGrid";
import { SectionHeading } from "@/components/ui/SectionHeading";

export async function HomeRoomsSection() {
  const rooms = await getPublicRooms();
  const roomSummaries = rooms.map(toRoomSummary);

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <SectionHeading eyebrow="Scegli il tuo destino" title="Le nostre stanze" />
      <RoomsGrid rooms={roomSummaries} />
    </section>
  );
}
