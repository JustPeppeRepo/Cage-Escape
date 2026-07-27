import type { Metadata } from "next";
import { prisma } from "@/app/_lib/prisma";
import { requireAdmin } from "@/lib/dal";
import { ensureWeeklyOpeningHours } from "@/app/_lib/bookings/weekly-hours";
import { ScheduleManager } from "@/components/admin/ScheduleManager";

export const metadata: Metadata = {
  title: "Orari | Admin",
  robots: { index: false, follow: false },
};

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default async function AdminSchedulePage() {
  await requireAdmin();

  const [rooms, overrides, weeklyHours] = await Promise.all([
    prisma.room.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.scheduleOverride.findMany({
      orderBy: { date: "asc" },
      include: { room: { select: { name: true } } },
    }),
    ensureWeeklyOpeningHours(),
  ]);

  return (
    <main>
      <h1 className="font-heading text-3xl text-blood-bright">
        Orari e chiusure
      </h1>
      <p className="mt-2 text-sm text-bone/60">
        Configura gli orari settimanali di default e gli override per date
        specifiche.
      </p>

      <div className="mt-8">
        <ScheduleManager
          rooms={rooms}
          weeklyHours={weeklyHours}
          overrides={overrides.map((override) => ({
            id: override.id,
            date: formatDateOnly(override.date),
            roomId: override.roomId,
            roomName: override.room?.name ?? null,
            type: override.type,
            openHour: override.openHour,
            closeHour: override.closeHour,
            reason: override.reason,
          }))}
        />
      </div>
    </main>
  );
}
