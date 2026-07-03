"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getAvailableSlots, holdSlot } from "@/app/_actions/bookings";
import { resolvePricingTier } from "@/app/_lib/bookings/pricing";
import { BookingCalendar } from "@/components/horror/booking/BookingCalendar";

type PricingTierPreview = {
  minParticipants: number;
  maxParticipants: number;
  totalPrice: string;
  depositPrice: string;
};

type BookingWidgetProps = {
  room: {
    slug: string;
    minPlayers: number;
    maxPlayers: number;
  };
  pricingTiers: PricingTierPreview[];
};

const TIME_FORMATTER = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome",
  hour: "2-digit",
  minute: "2-digit",
});

function formatSlotTime(iso: string): string {
  return TIME_FORMATTER.format(new Date(iso));
}

export function BookingWidget({ room, pricingTiers }: BookingWidgetProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState(room.minPlayers);
  const [minorCount, setMinorCount] = useState(0);
  const [paymentChoice, setPaymentChoice] = useState<"FULL" | "DEPOSIT">(
    "FULL",
  );

  const dateInputRef = useRef<HTMLInputElement>(null);
  const slotsFormRef = useRef<HTMLFormElement>(null);

  const [slotsState, slotsAction, slotsPending] = useActionState(
    getAvailableSlots,
    null,
  );
  const [holdState, holdAction, holdPending] = useActionState(
    holdSlot,
    null,
  );

  function requestSlotsForDate(date: string) {
    if (dateInputRef.current) {
      dateInputRef.current.value = date;
    }
    slotsFormRef.current?.requestSubmit();
  }

  function handleSelectDate(date: string) {
    setSelectedDate(date);
    setSelectedSlot(null);
    requestSlotsForDate(date);
  }

  const isSlotTaken =
    !!holdState && !holdState.success && holdState.code === "SLOT_TAKEN";
  // Se lo slot scelto e stato preso da un altro utente tra la selezione e il
  // submit, lo stato derivato qui sotto nasconde subito lo step 3 (nessun
  // setState sincrono nell'effetto), mentre l'effetto si limita a richiedere
  // gli slot aggiornati per la stessa data.
  const effectiveSelectedSlot = isSlotTaken ? null : selectedSlot;

  useEffect(() => {
    if (isSlotTaken && selectedDate) {
      requestSlotsForDate(selectedDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdState]);

  useEffect(() => {
    if (holdState?.success) {
      router.push(`/checkout?bookingId=${holdState.data.bookingId}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdState]);

  const previewTier = resolvePricingTier(pricingTiers, participantCount);

  if (holdState?.success) {
    return (
      <div className="rounded-md border border-ectoplasm/40 bg-void-deep p-6 text-bone">
        <h3 className="mb-2 font-[family-name:var(--font-display)] text-2xl text-ectoplasm">
          Slot bloccato
        </h3>
        <p className="text-sm text-bone/70">
          Reindirizzamento al pagamento…
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form ref={slotsFormRef} action={slotsAction} className="hidden">
        <input type="hidden" name="roomSlug" defaultValue={room.slug} />
        <input ref={dateInputRef} type="hidden" name="date" defaultValue="" />
      </form>

      <div>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-bone/60 uppercase">
          1. Scegli una data
        </h2>
        <BookingCalendar
          selectedDate={selectedDate}
          onSelectDate={handleSelectDate}
        />
      </div>

      {slotsPending ? (
        <p className="text-sm text-bone/60">Ricerca slot disponibili…</p>
      ) : null}

      {slotsState && !slotsState.success ? (
        <p className="text-sm text-blood-bright">{slotsState.error}</p>
      ) : null}

      {slotsState?.success ? (
        <div>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-bone/60 uppercase">
            2. Scegli un orario
          </h2>
          {slotsState.data.slots.length === 0 ? (
            <p className="text-sm text-bone/60">
              Nessuno slot disponibile per questa data. Prova un altro giorno.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {slotsState.data.slots.map((slot) => (
                <button
                  key={slot.startTime}
                  type="button"
                  onClick={() => setSelectedSlot(slot.startTime)}
                  className={`rounded border px-4 py-2 text-sm transition-colors ${
                    effectiveSelectedSlot === slot.startTime
                      ? "border-blood bg-blood text-bone"
                      : "border-void-mist text-bone/80 hover:bg-blood/20"
                  }`}
                >
                  {formatSlotTime(slot.startTime)}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {effectiveSelectedSlot ? (
        <form
          action={holdAction}
          className="flex flex-col gap-4 rounded-md border border-void-mist bg-void-deep p-6"
        >
          <h2 className="text-sm font-semibold tracking-wide text-bone/60 uppercase">
            3. Dettagli e conferma
          </h2>

          <input type="hidden" name="roomSlug" value={room.slug} readOnly />
          <input
            type="hidden"
            name="startTime"
            value={effectiveSelectedSlot}
            readOnly
          />

          <label className="flex flex-col gap-1 text-sm text-bone/80">
            Numero partecipanti ({room.minPlayers}-{room.maxPlayers})
            <input
              type="number"
              name="participantCount"
              min={room.minPlayers}
              max={room.maxPlayers}
              value={participantCount}
              onChange={(event) =>
                setParticipantCount(Number(event.target.value))
              }
              className="rounded border border-void-mist bg-void px-3 py-2 text-bone"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-bone/80">
            Di cui minorenni
            <input
              type="number"
              name="minorCount"
              min={0}
              max={participantCount}
              value={minorCount}
              onChange={(event) => setMinorCount(Number(event.target.value))}
              className="rounded border border-void-mist bg-void px-3 py-2 text-bone"
            />
          </label>

          <fieldset className="flex flex-col gap-2 text-sm text-bone/80">
            <legend className="mb-1">Modalità di pagamento</legend>
            <label className="flex items-center justify-between gap-2 rounded border border-void-mist px-3 py-2">
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="paymentChoice"
                  value="FULL"
                  checked={paymentChoice === "FULL"}
                  onChange={() => setPaymentChoice("FULL")}
                />
                Saldo completo
              </span>
              <span className="text-ectoplasm">
                {previewTier ? `${previewTier.totalPrice} €` : "—"}
              </span>
            </label>
            <label className="flex items-center justify-between gap-2 rounded border border-void-mist px-3 py-2">
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="paymentChoice"
                  value="DEPOSIT"
                  checked={paymentChoice === "DEPOSIT"}
                  onChange={() => setPaymentChoice("DEPOSIT")}
                />
                Solo caparra
              </span>
              <span className="text-ectoplasm">
                {previewTier ? `${previewTier.depositPrice} €` : "—"}
              </span>
            </label>
          </fieldset>

          {!previewTier ? (
            <p className="text-sm text-blood-bright">
              Nessuna fascia di prezzo disponibile per questo numero di
              partecipanti.
            </p>
          ) : null}

          {holdState && !holdState.success ? (
            <p className="text-sm text-blood-bright">
              {holdState.error}
              {holdState.code === "UNAUTHORIZED" ? (
                <>
                  {" "}
                  <a href="/login" className="underline">
                    Accedi
                  </a>
                </>
              ) : null}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={holdPending || !previewTier}
            className="rounded bg-blood px-4 py-2 text-bone transition-colors hover:bg-blood-bright disabled:cursor-not-allowed disabled:opacity-50"
          >
            {holdPending ? "Blocco in corso…" : "Blocca questo slot"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
