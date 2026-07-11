"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 2500;
const MAX_ATTEMPTS = 20; // ~50 secondi, oltre i quali il webhook e' anomalo

export function PaymentStatusPoller() {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (attemptsRef.current >= MAX_ATTEMPTS) {
      return;
    }

    const timeout = setTimeout(() => {
      attemptsRef.current += 1;
      setAttempts(attemptsRef.current);
      // Ri-esegue il Server Component della pagina corrente: se il webhook
      // Stripe ha nel frattempo aggiornato lo stato del booking, la nuova
      // render mostrera' l'esito definitivo al posto di questo poller.
      router.refresh();
    }, POLL_INTERVAL_MS);

    return () => clearTimeout(timeout);
  }, [attempts, router]);

  const timedOut = attempts >= MAX_ATTEMPTS;

  return (
    <div className="rounded-md border border-void-mist bg-void-deep p-6 text-bone">
      <h2 className="mb-2 font-heading text-xl text-blood-bright">
        {timedOut ? "Verifica in corso" : "Stiamo confermando il pagamento…"}
      </h2>
      <p className="text-sm text-bone/70">
        {timedOut
          ? "Il pagamento risulta ricevuto da Stripe ma la conferma sta impiegando più del previsto. Controlla le tue prenotazioni tra qualche minuto: se il problema persiste, contattaci."
          : "Il pagamento è stato ricevuto da Stripe: attendi qualche secondo mentre confermiamo la prenotazione."}
      </p>
    </div>
  );
}
