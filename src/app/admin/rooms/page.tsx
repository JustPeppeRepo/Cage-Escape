import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/app/_lib/prisma";
import { requireAdmin } from "@/lib/dal";
import { formatEuroAmount } from "@/app/_lib/bookings/money";

export const metadata: Metadata = {
  title: "Stanze | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminRoomsPage() {
  await requireAdmin();

  const rooms = await prisma.room.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { pricingTiers: true, bookings: true } },
    },
  });

  return (
    <main>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-3xl text-blood-bright">
          Stanze
        </h1>
        <Link
          href="/admin/rooms/new"
          className="rounded bg-blood px-4 py-2 text-sm text-bone hover:bg-blood-bright"
        >
          Nuova stanza
        </Link>
      </div>

      <div className="overflow-x-auto rounded border border-void-mist">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-void-mist bg-void-deep text-bone/60">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Prezzo da</th>
              <th className="px-4 py-3">Fasce</th>
              <th className="px-4 py-3">Stato</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.id} className="border-b border-void-mist/50">
                <td className="px-4 py-3 text-bone">{room.name}</td>
                <td className="px-4 py-3 text-bone/70">{room.slug}</td>
                <td className="px-4 py-3 text-bone/70">
                  {formatEuroAmount(room.prezzoTotale)} €
                </td>
                <td className="px-4 py-3 text-bone/70">{room._count.pricingTiers}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      room.isActive ? "text-ectoplasm" : "text-bone/40"
                    }
                  >
                    {room.isActive ? "Attiva" : "Disattiva"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/rooms/${room.id}`}
                    className="text-blood-bright hover:underline"
                  >
                    Modifica
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
