"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { createStripeCheckoutSession } from "@/app/_actions/bookings";

type CheckoutClientProps = {
  bookingId: string;
  holdExpiresAt: string;
  roomSlug: string;
  roomName: string;
  amount: string;
  paymentChoiceLabel: string;
};

function useCountdown(targetIso: string) {
  const [remainingMs, setRemainingMs] = useState(() =>
    Math.max(0, new Date(targetIso).getTime() - Date.now()),
  );

  useEffect(() => {
    const targetMs = new Date(targetIso).getTime();
    const interval = setInterval(() => {
      setRemainingMs(Math.max(0, targetMs - Date.now()));
    }, 1000);

    return () => clearInterval(interval);
  }, [targetIso]);

  return remainingMs;
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function CheckoutClient({
  bookingId,
  holdExpiresAt,
  roomSlug,
  roomName,
  amount,
  paymentChoiceLabel,
}: CheckoutClientProps) {
  const remainingMs = useCountdown(holdExpiresAt);
  const expired = remainingMs <= 0;

  const [state, formAction, pending] = useActionState(
    createStripeCheckoutSession,
    null,
  );

  useEffect(() => {
    if (state?.success) {
      // URL esterno (checkout.stripe.com): serve una navigazione reale del
      // browser, non un router.push interno di Next.js.
      window.location.href = state.data.url;
    }
  }, [state]);

  if (expired) {
    return (
      <div className="rounded-md border border-blood/60 bg-void-deep p-6 text-bone">
        <h2 className="mb-2 font-[family-name:var(--font-display)] text-xl text-blood-bright">
          Tempo scaduto
        </h2>
        <p className="mb-4 text-sm text-bone/70">
          I 10 minuti per completare il pagamento sono terminati e lo slot è
          tornato disponibile ad altri utenti.
        </p>
        <Link
          href={`/rooms/${roomSlug}`}
          className="inline-block rounded bg-blood px-4 py-2 text-sm text-bone transition-colors hover:bg-blood-bright"
        >
          Scegli un altro orario
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-void-mist bg-void-deep p-6 text-bone">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-bone/50">Stanza</dt>
        <dd>{roomName}</dd>
        <dt className="text-bone/50">Prenotazione</dt>
        <dd className="font-mono text-xs">{bookingId}</dd>
        <dt className="text-bone/50">Modalità di pagamento</dt>
        <dd>{paymentChoiceLabel}</dd>
        <dt className="text-bone/50">Importo</dt>
        <dd className="text-ectoplasm">{amount} €</dd>
      </dl>

      <div className="flex items-center justify-between rounded border border-void-mist px-4 py-3">
        <span className="text-sm text-bone/70">Tempo rimasto</span>
        <span
          className={`font-mono text-lg ${remainingMs < 60_000 ? "text-blood-bright" : "text-ectoplasm"}`}
        >
          {formatCountdown(remainingMs)}
        </span>
      </div>

      {state && !state.success ? (
        <p className="text-sm text-blood-bright">{state.error}</p>
      ) : null}

      <form action={formAction}>
        <input type="hidden" name="bookingId" value={bookingId} readOnly />
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-blood px-4 py-3 text-bone transition-colors hover:bg-blood-bright disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Reindirizzamento a Stripe…" : "Procedi al pagamento"}
        </button>
      </form>
    </div>
  );
}
