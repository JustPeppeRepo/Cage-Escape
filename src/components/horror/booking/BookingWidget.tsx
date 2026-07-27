"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  getAvailableSlots,
  getMonthClosedDates,
  holdSlot,
} from "@/app/_actions/bookings";
import type { BookingActionResult } from "@/app/_actions/bookings";
import type { SerializedTimeSlot } from "@/app/_lib/bookings/slots";
import { resolvePricingTier } from "@/app/_lib/bookings/pricing";
import { WAIVER_ACCEPT } from "@/app/_lib/bookings/waiver-upload";
import { BookingCalendar } from "@/components/horror/booking/BookingCalendar";

type PricingTierPreview = {
  minParticipants: number;
  maxParticipants: number;
  totalPrice: string;
  depositPrice: string;
};

type BookingWidgetProps = {
  room: {
    id: string;
    slug: string;
    minPlayers: number;
    maxPlayers: number;
    durationMinutes: number;
  };
  pricingTiers: PricingTierPreview[];
};

type HoldSlotPayload = {
  bookingId: string;
  holdExpiresAt: string;
  totalAmount: string;
  depositAmount: string;
};

type HoldActionState = BookingActionResult<HoldSlotPayload> | null;

const TIME_FORMATTER = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome",
  hour: "2-digit",
  minute: "2-digit",
});

const HOVER_PREFETCH_DELAY_MS = 80;

function formatSlotTime(iso: string): string {
  return TIME_FORMATTER.format(new Date(iso));
}

function clampQuantity(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

type QuantityStepperProps = {
  name: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
};

function QuantityStepper({
  name,
  value,
  min,
  max,
  onChange,
}: QuantityStepperProps) {
  const stepperButtonClassName =
    "flex w-10 shrink-0 items-center justify-center text-lg text-bone/80 transition-colors hover:bg-blood/20 hover:text-bone disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex items-stretch overflow-hidden rounded border border-void-mist bg-void">
      <button
        type="button"
        aria-label="Diminuisci"
        disabled={value <= min}
        onClick={() => onChange(clampQuantity(value - 1, min, max))}
        className={stepperButtonClassName}
      >
        −
      </button>
      <output className="flex min-w-[3rem] flex-1 items-center justify-center border-x border-void-mist px-3 py-2 text-bone tabular-nums">
        {value}
      </output>
      <input type="hidden" name={name} value={value} readOnly />
      <button
        type="button"
        aria-label="Aumenta"
        disabled={value >= max}
        onClick={() => onChange(clampQuantity(value + 1, min, max))}
        className={stepperButtonClassName}
      >
        +
      </button>
    </div>
  );
}

function padMonth(month: number): string {
  return String(month + 1).padStart(2, "0");
}

const DEPOSIT_PAYMENT_HINT =
  "Paghi ora solo la caparra per bloccare lo slot. Il saldo restante va saldato prima dell'ingresso in stanza.";

type InfoHintProps = {
  label: string;
  text: string;
};

function InfoHint({ label, text }: InfoHintProps) {
  return (
    <span className="group/info relative inline-flex shrink-0">
      <button
        type="button"
        aria-label={label}
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => event.stopPropagation()}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-bone/30 text-[10px] font-semibold leading-none text-bone/50 transition-colors hover:border-bone/50 hover:text-bone/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bone/50"
      >
        i
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-56 -translate-x-1/2 rounded border border-void-mist bg-void px-3 py-2 text-left text-xs leading-snug text-bone/80 opacity-0 shadow-lg transition-opacity group-hover/info:opacity-100 group-focus-within/info:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

function monthKey(year: number, month: number): string {
  return `${year}-${padMonth(month)}`;
}

function buildMonthFormData(
  room: BookingWidgetProps["room"],
  year: number,
  month: number,
): FormData {
  const formData = new FormData();
  formData.set("roomSlug", room.slug);
  formData.set("roomId", room.id);
  formData.set("year", String(year));
  formData.set("month", String(month + 1));
  return formData;
}

function buildSlotsFormData(
  room: BookingWidgetProps["room"],
  date: string,
): FormData {
  const formData = new FormData();
  formData.set("roomSlug", room.slug);
  formData.set("roomId", room.id);
  formData.set("durationMinutes", String(room.durationMinutes));
  formData.set("date", date);
  return formData;
}

export function BookingWidget({ room, pricingTiers }: BookingWidgetProps) {
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [closedDates, setClosedDates] = useState<Set<string>>(() => new Set());
  const [slotsCache, setSlotsCache] = useState<Record<string, SerializedTimeSlot[]>>({});
  const [slotsRequestDate, setSlotsRequestDate] = useState<string | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState(room.minPlayers);
  const [minorCount, setMinorCount] = useState(0);
  const [discountCode, setDiscountCode] = useState("");
  const [paymentChoice, setPaymentChoice] = useState<"FULL" | "DEPOSIT">("FULL");

  const closedMonthsLoadedRef = useRef(new Set<string>());
  const monthInFlightRef = useRef(new Set<string>());
  const closedRequestRef = useRef(0);
  const slotsRequestRef = useRef(0);
  const slotsCacheRef = useRef(slotsCache);
  const slotsInFlightRef = useRef(new Set<string>());
  const hoverPrefetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    slotsCacheRef.current = slotsCache;
  }, [slotsCache]);

  const fetchSlotsForDate = useCallback(
    async (date: string, options?: { background?: boolean }) => {
      if (slotsInFlightRef.current.has(date)) {
        return;
      }

      const background = options?.background ?? false;
      const requestId = background ? null : ++slotsRequestRef.current;

      if (!background) {
        setSlotsRequestDate(date);
        setSlotsError(null);
        if (slotsCacheRef.current[date] === undefined) {
          setSlotsLoading(true);
        }
      }

      slotsInFlightRef.current.add(date);

      try {
        const result = await getAvailableSlots(null, buildSlotsFormData(room, date));

        if (requestId !== null && requestId !== slotsRequestRef.current) {
          return;
        }

        if (!background) {
          setSlotsLoading(false);
        }

        if (!result.success) {
          if (!background) {
            setSlotsError(result.error);
          }
          return;
        }

        if (result.data.date !== date) {
          return;
        }

        setSlotsCache((prev) => {
          const incoming = result.data.slots;
          const existing = prev[date];
          if (
            existing &&
            existing.length === incoming.length &&
            existing.every(
              (slot, index) => slot.startTime === incoming[index]?.startTime,
            )
          ) {
            return prev;
          }
          return { ...prev, [date]: incoming };
        });

        if (!background) {
          setSelectedSlot((current) => {
            if (!current) {
              return current;
            }
            const stillAvailable = result.data.slots.some(
              (slot) => slot.startTime === current,
            );
            return stillAvailable ? current : null;
          });
        }
      } finally {
        slotsInFlightRef.current.delete(date);
      }
    },
    [room],
  );

  const holdSlotClientAction = useCallback(
    async (
      prevState: HoldActionState,
      formData: FormData,
    ): Promise<HoldActionState> => {
      const result = await holdSlot(prevState, formData);

      if (!result.success && result.code === "SLOT_TAKEN" && selectedDate) {
        await fetchSlotsForDate(selectedDate);
      }

      if (result.success) {
        router.push(`/checkout?bookingId=${result.data.bookingId}`);
      }

      return result;
    },
    [fetchSlotsForDate, router, selectedDate],
  );

  const [holdState, holdAction, holdPending] = useActionState(
    holdSlotClientAction,
    null,
  );

  const loadClosedDatesForMonth = useCallback(
    async (year: number, month: number) => {
      const key = monthKey(year, month);
      if (closedMonthsLoadedRef.current.has(key)) {
        return;
      }

      if (monthInFlightRef.current.has(`closed:${key}`)) {
        return;
      }

      monthInFlightRef.current.add(`closed:${key}`);
      const requestId = closedRequestRef.current + 1;
      closedRequestRef.current = requestId;

      try {
        const result = await getMonthClosedDates(
          null,
          buildMonthFormData(room, year, month),
        );

        if (closedRequestRef.current !== requestId || !result.success) {
          return;
        }

        closedMonthsLoadedRef.current.add(key);
        setClosedDates((prev) => {
          const next = new Set(prev);
          for (const date of result.data.closedDates) {
            next.add(date);
          }
          return next;
        });
      } finally {
        monthInFlightRef.current.delete(`closed:${key}`);
      }
    },
    [room],
  );

  const handleMonthChange = useCallback(
    (year: number, month: number) => {
      void loadClosedDatesForMonth(year, month);
    },
    [loadClosedDatesForMonth],
  );

  const handleDayHover = useCallback(
    (date: string) => {
      if (hoverPrefetchTimeoutRef.current) {
        clearTimeout(hoverPrefetchTimeoutRef.current);
      }

      hoverPrefetchTimeoutRef.current = setTimeout(() => {
        if (slotsCacheRef.current[date] !== undefined) {
          return;
        }
        void fetchSlotsForDate(date, { background: true });
      }, HOVER_PREFETCH_DELAY_MS);
    },
    [fetchSlotsForDate],
  );

  function handleSelectDate(date: string) {
    setSelectedDate(date);
    setSelectedSlot(null);
    setSlotsRequestDate(date);
    setSlotsError(null);

    if (slotsCacheRef.current[date] !== undefined) {
      void fetchSlotsForDate(date, { background: true });
      return;
    }

    void fetchSlotsForDate(date);
  }

  function handleParticipantCountChange(value: number) {
    setParticipantCount(value);
    setMinorCount((current) => Math.min(current, value));
  }

  useEffect(() => {
    return () => {
      if (hoverPrefetchTimeoutRef.current) {
        clearTimeout(hoverPrefetchTimeoutRef.current);
      }
    };
  }, []);

  const isSlotTaken =
    !!holdState && !holdState.success && holdState.code === "SLOT_TAKEN";
  const effectiveSelectedSlot = isSlotTaken ? null : selectedSlot;

  // #region agent log
  useEffect(() => {
    if (!effectiveSelectedSlot) return;
    fetch("http://127.0.0.1:7808/ingest/f514f2e9-5ac4-48b3-b1b3-d645f78092c0", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "3f9b72",
      },
      body: JSON.stringify({
        sessionId: "3f9b72",
        runId: process.env.NODE_ENV === "development" ? "post-fix" : "pre-fix",
        hypothesisId: "H1",
        location: "BookingWidget.tsx:hold-form",
        message: "hold form visible with server action",
        data: {
          holdActionType: typeof holdAction,
          hasFileInputs: minorCount > 0,
          minorCount,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }, [effectiveSelectedSlot, holdAction, minorCount]);
  // #endregion

  const previewTier = resolvePricingTier(pricingTiers, participantCount);

  const cachedSlotsForSelectedDate =
    selectedDate !== null ? slotsCache[selectedDate] : undefined;
  const showSlotsSection =
    selectedDate !== null &&
    slotsRequestDate === selectedDate &&
    cachedSlotsForSelectedDate !== undefined;
  const showSlotsLoader =
    selectedDate !== null &&
    slotsRequestDate === selectedDate &&
    cachedSlotsForSelectedDate === undefined &&
    slotsLoading;
  const showSlotsError =
    selectedDate !== null &&
    slotsRequestDate === selectedDate &&
    !slotsLoading &&
    slotsError !== null;

  if (holdState?.success) {
    return (
      <div className="rounded-md border border-ectoplasm/40 bg-void-deep p-6 text-bone">
        <h3 className="mb-2 font-heading text-2xl text-blood-bright">
          Slot bloccato
        </h3>
        <p className="text-sm text-bone/70">Reindirizzamento al pagamento…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 min-[550px]:grid min-[550px]:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] min-[550px]:items-start min-[550px]:gap-x-6 min-[550px]:gap-y-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-x-10">
      <div className="min-w-0 w-full min-[550px]:max-w-[17rem] lg:max-w-none">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-bone/60 uppercase">
          1. Scegli una data
        </h2>
        <BookingCalendar
          selectedDate={selectedDate}
          closedDates={closedDates}
          onSelectDate={handleSelectDate}
          onMonthChange={handleMonthChange}
          onDayHover={handleDayHover}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        {showSlotsLoader ? (
          <p className="text-sm text-bone/60">Ricerca slot disponibili…</p>
        ) : null}

        {showSlotsError ? (
          <p className="text-sm text-blood-bright">{slotsError}</p>
        ) : null}

        {showSlotsSection ? (
          <div>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-bone/60 uppercase">
              2. Scegli un orario
            </h2>
            {cachedSlotsForSelectedDate.length === 0 ? (
              <p className="text-sm text-bone/60">
                Nessuno slot disponibile per questa data. Prova un altro giorno.
              </p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {cachedSlotsForSelectedDate.map((slot) => (
                  <button
                    key={slot.startTime}
                    type="button"
                    onClick={() => setSelectedSlot(slot.startTime)}
                    className={`min-w-[7.5rem] rounded border px-4 py-3 text-base transition-colors ${
                      effectiveSelectedSlot === slot.startTime
                        ? "border-blood bg-blood text-bone"
                        : "border-void-mist text-bone/80 hover:bg-blood/20"
                    }`}
                  >
                    {formatSlotTime(slot.startTime)} –{" "}
                    {formatSlotTime(slot.endTime)}
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
              <QuantityStepper
                name="participantCount"
                value={participantCount}
                min={room.minPlayers}
                max={room.maxPlayers}
                onChange={handleParticipantCountChange}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-bone/80">
              Di cui minorenni
              <QuantityStepper
                name="minorCount"
                value={minorCount}
                min={0}
                max={participantCount}
                onChange={setMinorCount}
              />
            </label>

            {minorCount > 0 ? (
              <div className="flex flex-col gap-4 rounded border border-blood/40 bg-blood/10 p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <a
                    href="/documents/liberatoria.pdf"
                    download="liberatoria-cageroom.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded border border-ectoplasm bg-ectoplasm px-3 py-1.5 font-semibold text-void transition-colors hover:bg-ectoplasm/90"
                  >
                    Scarica PDF
                  </a>
                  <span className="font-semibold text-blood-bright">
                    ATTENZIONE liberatoria obbligatoria
                  </span>
                </div>
                <p className="text-xs text-bone/60">
                  1. Scarica il modulo PDF · 2. Stampalo e compilalo · 3. Caricalo
                  qui sotto per ogni minorenne (PDF, JPG o PNG, max 900 KB).
                </p>
                {Array.from({ length: minorCount }, (_, index) => {
                  const minorNumber = index + 1;
                  return (
                    <label
                      key={minorNumber}
                      className="flex flex-col gap-1 text-sm text-bone/80"
                    >
                      Carica liberatoria minorenne {minorNumber}
                      <input
                        type="file"
                        name={`waiver_${minorNumber}`}
                        accept={WAIVER_ACCEPT}
                        required
                        className="rounded border border-void-mist bg-void px-3 py-2 text-sm text-bone file:mr-3 file:rounded file:border-0 file:bg-blood file:px-3 file:py-1 file:text-sm file:text-bone hover:file:bg-blood-bright"
                      />
                    </label>
                  );
                })}
              </div>
            ) : null}

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
                    onChange={() => {
                      setPaymentChoice("DEPOSIT");
                      setDiscountCode("");
                    }}
                  />
                  Blocca la prenotazione
                  <InfoHint
                    label="Cosa significa bloccare la prenotazione"
                    text={DEPOSIT_PAYMENT_HINT}
                  />
                </span>
                <span className="text-ectoplasm">
                  {previewTier ? `${previewTier.depositPrice} €` : "—"}
                </span>
              </label>
            </fieldset>

            {paymentChoice === "FULL" ? (
              <label className="flex flex-col gap-1 text-sm text-bone/80">
                Codice sconto (opzionale)
                <input
                  type="text"
                  name="discountCode"
                  value={discountCode}
                  onChange={(event) =>
                    setDiscountCode(event.target.value.toUpperCase())
                  }
                  placeholder="RITO-XXXX-XXXX"
                  className="rounded border border-void-mist bg-void px-3 py-2 text-bone uppercase"
                />
              </label>
            ) : null}

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
    </div>
  );
}
