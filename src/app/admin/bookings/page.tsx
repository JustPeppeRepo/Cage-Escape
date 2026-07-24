import type { Metadata } from "next";
import Link from "next/link";
import { BookingStatus } from "@/generated/prisma/client";
import { prisma } from "@/app/_lib/prisma";
import { requireAdmin } from "@/lib/dal";
import { formatEuroAmount } from "@/app/_lib/bookings/money";
import { CancelBookingButton } from "@/components/admin/CancelBookingButton";

export const metadata: Metadata = {
  title: "Prenotazioni | Admin",
  robots: { index: false, follow: false },
};

const STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: "In attesa",
  DEPOSIT_PAID: "Caparra pagata",
  PAID: "Pagata",
  CANCELLED: "Annullata",
  COMPLETED: "Completata",
  PAYMENT_CONFLICT_REFUND_REQUIRED: "Conflitto pagamento",
};

type AdminBookingsPageProps = {
  searchParams: Promise<{ status?: string }>;
};

export default async function AdminBookingsPage({
  searchParams,
}: AdminBookingsPageProps) {
  await requireAdmin();
  const { status: statusFilter } = await searchParams;

  const validStatuses = Object.values(BookingStatus);
  const status =
    statusFilter && validStatuses.includes(statusFilter as BookingStatus)
      ? (statusFilter as BookingStatus)
      : undefined;

  const bookings = await prisma.booking.findMany({
    where: status ? { status } : undefined,
    orderBy: { startTime: "desc" },
    take: 100,
    include: {
      room: { select: { name: true } },
      user: { select: { name: true, email: true } },
      waivers: {
        select: {
          id: true,
          minorIndex: true,
          fileName: true,
        },
        orderBy: { minorIndex: "asc" },
      },
    },
  });

  return (
    <main>
      <h1 className="font-heading text-3xl text-blood-bright">
        Prenotazioni
      </h1>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <FilterLink href="/admin/bookings" active={!status}>
          Tutte
        </FilterLink>
        {validStatuses.map((value) => (
          <FilterLink
            key={value}
            href={`/admin/bookings?status=${value}`}
            active={status === value}
          >
            {STATUS_LABELS[value]}
          </FilterLink>
        ))}
      </div>

      <div className="mt-8 overflow-x-auto rounded border border-void-mist">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-void-mist bg-void-deep text-bone/60">
            <tr>
              <th className="px-4 py-3">Data/ora</th>
              <th className="px-4 py-3">Stanza</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Partecipanti</th>
              <th className="px-4 py-3">Importo</th>
              <th className="px-4 py-3">Stato</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {bookings.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-bone/50">
                  Nessuna prenotazione trovata.
                </td>
              </tr>
            ) : (
              bookings.map((booking) => (
                <tr
                  key={booking.id}
                  className={`border-b border-void-mist/50 ${
                    booking.status === BookingStatus.PAYMENT_CONFLICT_REFUND_REQUIRED
                      ? "bg-blood/5"
                      : ""
                  }`}
                >
                  <td className="px-4 py-3 text-bone/80">
                    {booking.startTime.toLocaleString("it-IT", {
                      timeZone: "Europe/Rome",
                    })}
                  </td>
                  <td className="px-4 py-3 text-bone">{booking.room.name}</td>
                  <td className="px-4 py-3 text-bone/70">
                    <span className="block">{booking.user.name}</span>
                    <span className="text-xs">{booking.user.email}</span>
                  </td>
                  <td className="px-4 py-3 text-bone/70">
                    <span className="block">{booking.participantCount} totali</span>
                    {booking.minorCount > 0 ? (
                      <>
                        <span className="block text-xs text-bone/50">
                          {booking.minorCount} minorenni
                        </span>
                        <div className="mt-2 flex flex-col gap-1">
                          {booking.waivers.map((waiver) => (
                            <a
                              key={waiver.id}
                              href={`/api/admin/waivers/${waiver.id}`}
                              className="text-xs text-ectoplasm underline underline-offset-2"
                            >
                              Liberatoria {waiver.minorIndex}
                            </a>
                          ))}
                          {booking.waivers.length < booking.minorCount ? (
                            <span className="text-xs text-blood-bright">
                              Liberatorie mancanti
                            </span>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-bone/50">Nessun minorenne</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-bone/70">
                    {formatEuroAmount(booking.totalAmount)} €
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        booking.status ===
                        BookingStatus.PAYMENT_CONFLICT_REFUND_REQUIRED
                          ? "text-blood-bright"
                          : "text-bone/80"
                      }
                    >
                      {STATUS_LABELS[booking.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {booking.status !== BookingStatus.CANCELLED &&
                    booking.status !== BookingStatus.COMPLETED ? (
                      <CancelBookingButton bookingId={booking.id} />
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded px-3 py-1 ${
        active
          ? "bg-blood text-bone"
          : "border border-void-mist text-bone/70 hover:text-bone"
      }`}
    >
      {children}
    </Link>
  );
}
