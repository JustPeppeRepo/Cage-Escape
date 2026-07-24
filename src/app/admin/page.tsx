import type { Metadata } from "next";
import Link from "next/link";
import { BookingStatus } from "@/generated/prisma/client";
import { prisma } from "@/app/_lib/prisma";
import { requireAdmin } from "@/lib/dal";

export const metadata: Metadata = {
  title: "Amministrazione",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const session = await requireAdmin();

  const [
    pendingBookings,
    conflictBookings,
    upcomingBookings,
    roomCount,
    unreadMessages,
  ] = await Promise.all([
    prisma.booking.count({ where: { status: BookingStatus.PENDING } }),
    prisma.booking.count({
      where: { status: BookingStatus.PAYMENT_CONFLICT_REFUND_REQUIRED },
    }),
    prisma.booking.count({
      where: {
        status: { in: [BookingStatus.PAID, BookingStatus.DEPOSIT_PAID] },
        startTime: { gte: new Date() },
      },
    }),
    prisma.room.count(),
    prisma.contactMessage.count({ where: { read: false } }),
  ]);

  const cards = [
    {
      label: "Prenotazioni in attesa",
      value: pendingBookings,
      href: "/admin/bookings?status=PENDING",
    },
    {
      label: "Conflitti pagamento",
      value: conflictBookings,
      href: "/admin/bookings?status=PAYMENT_CONFLICT_REFUND_REQUIRED",
      alert: conflictBookings > 0,
    },
    {
      label: "Prossime confermate",
      value: upcomingBookings,
      href: "/admin/bookings",
    },
    { label: "Stanze", value: roomCount, href: "/admin/rooms" },
    {
      label: "Messaggi da leggere",
      value: unreadMessages,
      href: "/admin/contatti",
      alert: unreadMessages > 0,
    },
  ];

  return (
    <main>
      <h1 className="font-heading text-3xl text-blood-bright">
        Pannello amministrazione
      </h1>
      <p className="mt-2 text-bone/70">Bentornato, {session.user.name}.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className={`rounded border p-4 transition-colors hover:border-blood/50 ${
              card.alert
                ? "border-blood bg-blood/10"
                : "border-void-mist bg-void-deep"
            }`}
          >
            <p className="text-sm text-bone/60">{card.label}</p>
            <p className="mt-2 text-3xl text-bone">{card.value}</p>
          </Link>
        ))}
      </div>

      <nav className="mt-8 flex flex-wrap gap-3 md:hidden">
        <Link href="/admin/rooms" className="text-sm text-blood-bright underline">
          Stanze
        </Link>
        <Link href="/admin/schedule" className="text-sm text-blood-bright underline">
          Orari
        </Link>
        <Link href="/admin/bookings" className="text-sm text-blood-bright underline">
          Prenotazioni
        </Link>
        <Link href="/admin/reviews" className="text-sm text-blood-bright underline">
          Recensioni
        </Link>
        <Link href="/admin/contatti" className="text-sm text-blood-bright underline">
          Messaggi
        </Link>
        <Link href="/admin/impostazioni" className="text-sm text-blood-bright underline">
          Impostazioni
        </Link>
      </nav>
    </main>
  );
}
