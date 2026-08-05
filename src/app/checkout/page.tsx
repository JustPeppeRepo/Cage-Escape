/**
 * Checkout `/checkout?bookingId=`
 *
 * @description Completa pagamento di un hold attivo (auth + ownership).
 * @components CheckoutClient → createStripeCheckoutSession
 * @auth requireUser
 * @data prisma.booking, resolvePricingTier, getBookingChargeAmount
 * @seo noindex
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/app/_lib/prisma";
import { BookingStatus } from "@/generated/prisma/client";
import { formatEuroAmount } from "@/app/_lib/bookings/money";
import { resolvePricingTier } from "@/app/_lib/bookings/pricing";
import { getBookingChargeAmount } from "@/app/_lib/bookings/charge-amount";
import { CheckoutClient } from "@/components/horror/checkout/CheckoutClient";

export const metadata: Metadata = {
  title: "Completa la prenotazione",
  robots: { index: false, follow: false },
};

type CheckoutPageProps = {
  searchParams: Promise<{ bookingId?: string }>;
};

function paymentChoiceLabel(choice: string): string {
  return choice === "FULL" ? "Saldo completo" : "Caparra";
}

export default async function CheckoutPage({
  searchParams,
}: CheckoutPageProps) {
  const { bookingId } = await searchParams;
  const session = await requireUser();

  if (!bookingId) {
    notFound();
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      room: { include: { pricingTiers: true } },
      discountCode: true,
    },
  });

  // notFound() invece di un 403 esplicito: non vogliamo confermare a un
  // utente non autorizzato che un certo bookingId esiste ma appartiene a
  // qualcun altro (evita un oracolo di enumerazione).
  if (!booking || booking.userId !== session.user.id) {
    notFound();
  }

  const tier = resolvePricingTier(
    booking.room.pricingTiers,
    booking.participantCount,
  );
  // getBookingChargeAmount applica lo sconto associato al booking: senza
  // questo l'importo mostrato in pagina non corrispondeva a quello
  // effettivamente addebitato da Stripe (che lo sconto lo applica sempre
  // correttamente, vedi createStripeCheckoutSession).
  const chargeAmount = tier
    ? getBookingChargeAmount(booking, tier)
    : booking.totalAmount;

  // Server Component eseguito una sola volta per request (nessun
  // re-render riutilizzabile come nei Client Component): Date.now() qui
  // e' sicuro nonostante la regola di "purity" pensata per componenti che
  // React puo' rieseguire piu' volte con lo stesso input.
  const now = Date.now(); // eslint-disable-line react-hooks/purity
  const isHoldActive =
    booking.status === BookingStatus.PENDING &&
    !!booking.holdExpiresAt &&
    booking.holdExpiresAt.getTime() > now;

  return (
    <main className="min-h-screen bg-void px-6 py-24 text-bone">
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <h1 className="font-heading text-3xl text-blood-bright">
          Completa la prenotazione
        </h1>

        {isHoldActive ? (
          <CheckoutClient
            bookingId={booking.id}
            holdExpiresAt={booking.holdExpiresAt!.toISOString()}
            roomSlug={booking.room.slug}
            roomName={booking.room.name}
            amount={formatEuroAmount(chargeAmount)}
            paymentChoiceLabel={paymentChoiceLabel(booking.paymentChoice)}
          />
        ) : booking.status === BookingStatus.PAID ||
          booking.status === BookingStatus.DEPOSIT_PAID ? (
          <div className="rounded-md border border-ectoplasm/40 bg-void-deep p-6">
            <h2 className="mb-2 font-heading text-xl text-blood-bright">
              Hai già completato questo pagamento
            </h2>
            <Link href="/rooms" className="underline decoration-blood underline-offset-4">
              Torna alle stanze
            </Link>
          </div>
        ) : (
          <div className="rounded-md border border-blood/60 bg-void-deep p-6">
            <h2 className="mb-2 font-heading text-xl text-blood-bright">
              Questa prenotazione non è più valida
            </h2>
            <p className="mb-4 text-sm text-bone/70">
              Il tempo per completare il pagamento è scaduto o la
              prenotazione è stata annullata.
            </p>
            <Link
              href={`/rooms/${booking.room.slug}`}
              className="inline-block rounded bg-blood px-4 py-2 text-sm text-bone transition-colors hover:bg-blood-bright"
            >
              Scegli un altro orario
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
