import type { Metadata } from "next";
import { prisma } from "@/app/_lib/prisma";
import { requireUser } from "@/lib/dal";
import { formatEuroAmount } from "@/app/_lib/bookings/money";
import { getCancellationEligibility } from "@/app/_lib/bookings/refund-policy";
import {
  AccountDashboard,
  type AccountBooking,
} from "@/components/account/AccountDashboard";

export const metadata: Metadata = {
  title: "Il mio account",
  robots: { index: false, follow: false },
  alternates: { canonical: "/account" },
};

export default async function AccountPage() {
  const session = await requireUser();

  const bookings = await prisma.booking.findMany({
    where: { userId: session.user.id },
    include: {
      room: { select: { name: true, slug: true } },
    },
    orderBy: { startTime: "desc" },
  });

  const serializedBookings: AccountBooking[] = bookings.map((booking) => {
    const eligibility = getCancellationEligibility(booking);

    return {
      id: booking.id,
      startTime: booking.startTime.toISOString(),
      endTime: booking.endTime.toISOString(),
      totalAmount: formatEuroAmount(booking.totalAmount),
      status: booking.status,
      holdExpiresAt: booking.holdExpiresAt?.toISOString() ?? null,
      room: booking.room,
      cancellation:
        eligibility.kind === "REFUND_ELIGIBLE"
          ? {
              kind: eligibility.kind,
              refundCutoffAt: eligibility.refundCutoffAt.toISOString(),
            }
          : { kind: eligibility.kind, refundCutoffAt: null },
    };
  });

  const phone =
    typeof session.user.phone === "string" ? session.user.phone : "";

  return (
    <main className="min-h-screen bg-void px-4 py-16 text-bone sm:px-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <div>
          <h1 className="font-heading text-4xl text-blood-bright">
            Il mio account
          </h1>
          <p className="mt-2 text-bone/60">
            Gestisci profilo, ordini e sicurezza del tuo account.
          </p>
        </div>

        <AccountDashboard
          user={{
            name: session.user.name,
            email: session.user.email,
            phone,
            image: session.user.image ?? null,
          }}
          bookings={serializedBookings}
        />
      </div>
    </main>
  );
}
