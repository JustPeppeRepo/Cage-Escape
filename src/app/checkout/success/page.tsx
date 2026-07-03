import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/app/_lib/prisma";
import { BookingStatus, PaymentStatus } from "@/generated/prisma/client";
import { formatEuroAmount } from "@/app/_lib/bookings/money";
import { PaymentStatusPoller } from "@/components/horror/checkout/PaymentStatusPoller";

export const metadata: Metadata = {
  title: "Pagamento | Cage Room",
  robots: { index: false, follow: false },
};

type CheckoutSuccessPageProps = {
  searchParams: Promise<{ session_id?: string }>;
};

const DATETIME_FORMATTER = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome",
  dateStyle: "full",
  timeStyle: "short",
});

export default async function CheckoutSuccessPage({
  searchParams,
}: CheckoutSuccessPageProps) {
  const { session_id: sessionId } = await searchParams;
  const session = await requireUser();

  if (!sessionId) {
    notFound();
  }

  const booking = await prisma.booking.findUnique({
    where: { stripeSessionId: sessionId },
    include: {
      room: true,
      payments: {
        where: { status: PaymentStatus.SUCCEEDED },
        orderBy: { paidAt: "desc" },
        take: 1,
      },
    },
  });

  // notFound() invece di 403: non confermiamo l'esistenza di una sessione
  // Stripe/prenotazione altrui a chi non ne e' il proprietario.
  if (!booking || booking.userId !== session.user.id) {
    notFound();
  }

  const isConfirmed =
    booking.status === BookingStatus.PAID ||
    booking.status === BookingStatus.DEPOSIT_PAID;
  const isConflict =
    booking.status === BookingStatus.PAYMENT_CONFLICT_REFUND_REQUIRED;
  const isCancelled = booking.status === BookingStatus.CANCELLED;
  const paidAmount = booking.payments[0]?.amount ?? booking.totalAmount;

  return (
    <main className="min-h-screen bg-void px-6 py-24 text-bone">
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        {isConfirmed ? (
          <div className="rounded-md border border-ectoplasm/40 bg-void-deep p-6">
            <h1 className="mb-2 font-[family-name:var(--font-display)] text-3xl text-ectoplasm">
              Prenotazione confermata
            </h1>
            <p className="mb-4 text-sm text-bone/70">
              Ti aspettiamo, se hai il coraggio di presentarti.
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-bone/50">Stanza</dt>
              <dd>{booking.room.name}</dd>
              <dt className="text-bone/50">Data e ora</dt>
              <dd>{DATETIME_FORMATTER.format(booking.startTime)}</dd>
              <dt className="text-bone/50">Partecipanti</dt>
              <dd>{booking.participantCount}</dd>
              <dt className="text-bone/50">Importo pagato</dt>
              <dd className="text-ectoplasm">
                {formatEuroAmount(paidAmount)} €
              </dd>
            </dl>
            <Link
              href="/rooms"
              className="mt-6 inline-block rounded bg-blood px-4 py-2 text-sm text-bone transition-colors hover:bg-blood-bright"
            >
              Esplora altre stanze
            </Link>
          </div>
        ) : isConflict ? (
          <div className="rounded-md border border-blood/60 bg-void-deep p-6">
            <h1 className="mb-2 font-[family-name:var(--font-display)] text-2xl text-blood-bright">
              Pagamento ricevuto, slot non più disponibile
            </h1>
            <p className="text-sm text-bone/70">
              Il tuo pagamento è stato ricevuto ma nel frattempo lo slot è
              stato occupato da un&apos;altra prenotazione. Ti rimborseremo
              l&apos;importo a breve: contattaci se non ricevi notizie entro
              qualche giorno.
            </p>
          </div>
        ) : isCancelled ? (
          <div className="rounded-md border border-blood/60 bg-void-deep p-6">
            <h1 className="mb-2 font-[family-name:var(--font-display)] text-2xl text-blood-bright">
              Prenotazione annullata
            </h1>
            <p className="mb-4 text-sm text-bone/70">
              Questa prenotazione non è andata a buon fine. Se hai effettuato
              un pagamento, verrà rimborsato automaticamente da Stripe.
            </p>
            <Link
              href={`/rooms/${booking.room.slug}`}
              className="inline-block rounded bg-blood px-4 py-2 text-sm text-bone transition-colors hover:bg-blood-bright"
            >
              Riprova
            </Link>
          </div>
        ) : (
          <PaymentStatusPoller />
        )}
      </div>
    </main>
  );
}
