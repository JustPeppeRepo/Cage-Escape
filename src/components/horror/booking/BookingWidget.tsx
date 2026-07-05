"use client";

import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  getAvailableSlots,
  getMonthAvailability,
  getMonthClosedDates,
  holdSlot,
} from "@/app/_actions/bookings";
import type { DayAvailabilityStatus, SerializedTimeSlot } from "@/app/_lib/bookings/slots";
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

const TIME_FORMATTER = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome",
  hour: "2-digit",
  minute: "2-digit",
});

const HOVER_PREFETCH_DELAY_MS = 150;
const FULL_MONTH_DEFER_MS = 2_500;
const FULL_MONTH_RESUME_MS = 1_500;

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

function mergeFullMonthAvailability(
  prev: Record<string, DayAvailabilityStatus>,
  incoming: Record<string, DayAvailabilityStatus>,
): Record<string, DayAvailabilityStatus> {
  const next = { ...prev };

  for (const [date, status] of Object.entries(incoming)) {
    if (status === "unavailable") {
      next[date] = "unavailable";
    } else if (prev[date] !== "unavailable") {
      next[date] = status;
    }
  }

  return next;
}

export function BookingWidget({ room, pricingTiers }: BookingWidgetProps) {
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [dayAvailability, setDayAvailability] = useState<
    Record<string, DayAvailabilityStatus>
  >({});
  const [isRefiningAvailability, setIsRefiningAvailability] = useState(false);
  const [slotsCache, setSlotsCache] = useState<Record<string, SerializedTimeSlot[]>>({});
  const [slotsRequestDate, setSlotsRequestDate] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState(room.minPlayers);
  const [minorCount, setMinorCount] = useState(0);
  const [discountCode, setDiscountCode] = useState("");
  const [paymentChoice, setPaymentChoice] = useState<"FULL" | "DEPOSIT">("FULL");

  const dateInputRef = useRef<HTMLInputElement>(null);
  const slotsFormRef = useRef<HTMLFormElement>(null);
  const closedMonthsLoadedRef = useRef(new Set<string>());
  const fullMonthsLoadedRef = useRef(new Set<string>());
  const monthInFlightRef = useRef(new Set<string>());
  const closedRequestRef = useRef(0);
  const fullMonthRequestRef = useRef(0);
  const fullMonthTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pauseFullMonthRef = useRef(false);
  const viewedMonthRef = useRef({ year: new Date().getFullYear(), month: new Date().getMonth() });
  const hoverPrefetchInFlightRef = useRef(new Set<string>());
  const hoverPrefetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slotsCacheRef = useRef(slotsCache);
  useEffect(() => {
    slotsCacheRef.current = slotsCache;
  }, [slotsCache]);

  useEffect(() => {
    setMinorCount((current) => Math.min(current, participantCount));
  }, [participantCount]);

  const applyClosedDates = useCallback((closedDates: string[]) => {
    if (closedDates.length === 0) {
      return;
    }

    setDayAvailability((prev) => {
      const next = { ...prev };
      for (const date of closedDates) {
        next[date] = "unavailable";
      }
      return next;
    });
  }, []);

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
        applyClosedDates(result.data.closedDates);
      } finally {
        monthInFlightRef.current.delete(`closed:${key}`);
      }
    },
    [applyClosedDates, room],
  );

  const loadFullMonthAvailability = useCallback(
    async (year: number, month: number) => {
      if (pauseFullMonthRef.current) {
        return;
      }

      const key = monthKey(year, month);
      if (fullMonthsLoadedRef.current.has(key)) {
        return;
      }

      if (monthInFlightRef.current.has(`full:${key}`)) {
        return;
      }

      monthInFlightRef.current.add(`full:${key}`);
      const requestId = fullMonthRequestRef.current + 1;
      fullMonthRequestRef.current = requestId;
      setIsRefiningAvailability(true);

      try {
        const result = await getMonthAvailability(
          null,
          buildMonthFormData(room, year, month),
        );

        if (
          fullMonthRequestRef.current !== requestId ||
          !result.success ||
          pauseFullMonthRef.current
        ) {
          return;
        }

        fullMonthsLoadedRef.current.add(key);
        setDayAvailability((prev) =>
          mergeFullMonthAvailability(prev, result.data.days),
        );
      } finally {
        monthInFlightRef.current.delete(`full:${key}`);
        if (fullMonthRequestRef.current === requestId) {
          setIsRefiningAvailability(false);
        }
      }
    },
    [room],
  );

  const scheduleFullMonthLoad = useCallback(
    (year: number, month: number, delayMs = FULL_MONTH_DEFER_MS) => {
      if (fullMonthTimeoutRef.current) {
        clearTimeout(fullMonthTimeoutRef.current);
      }

      fullMonthTimeoutRef.current = setTimeout(() => {
        void loadFullMonthAvailability(year, month);
      }, delayMs);
    },
    [loadFullMonthAvailability],
  );

  const handleMonthChange = useCallback(
    (year: number, month: number) => {
      viewedMonthRef.current = { year, month };
      void loadClosedDatesForMonth(year, month);
      scheduleFullMonthLoad(year, month);
    },
    [loadClosedDatesForMonth, scheduleFullMonthLoad],
  );

  const prefetchSlotsForDate = useCallback(
    async (date: string) => {
      if (slotsCacheRef.current[date] !== undefined) {
        return;
      }

      if (hoverPrefetchInFlightRef.current.has(date)) {
        return;
      }

      hoverPrefetchInFlightRef.current.add(date);

      const formData = new FormData();
      formData.set("roomSlug", room.slug);
      formData.set("roomId", room.id);
      formData.set("date", date);

      try {
        const result = await getAvailableSlots(null, formData);
        if (!result.success || result.data.date !== date) {
          return;
        }

        setSlotsCache((prev) => {
          if (prev[date] !== undefined) {
            return prev;
          }
          return { ...prev, [date]: result.data.slots };
        });
      } finally {
        hoverPrefetchInFlightRef.current.delete(date);
      }
    },
    [room.id, room.slug],
  );

  const handleDayHover = useCallback(
    (date: string) => {
      if (hoverPrefetchTimeoutRef.current) {
        clearTimeout(hoverPrefetchTimeoutRef.current);
      }

      hoverPrefetchTimeoutRef.current = setTimeout(() => {
        void prefetchSlotsForDate(date);
      }, HOVER_PREFETCH_DELAY_MS);
    },
    [prefetchSlotsForDate],
  );

  const [slotsState, slotsAction, slotsPending] = useActionState(
    getAvailableSlots,
    null,
  );
  const [holdState, holdAction, holdPending] = useActionState(holdSlot, null);

  function refreshSlotsForDate(date: string) {
    setSlotsRequestDate(date);
    if (dateInputRef.current) {
      dateInputRef.current.value = date;
    }
    slotsFormRef.current?.requestSubmit();
  }

  function handleSelectDate(date: string) {
    setSelectedDate(date);
    setSelectedSlot(null);

    pauseFullMonthRef.current = true;
    if (fullMonthTimeoutRef.current) {
      clearTimeout(fullMonthTimeoutRef.current);
      fullMonthTimeoutRef.current = null;
    }

    if (slotsCacheRef.current[date] !== undefined) {
      startTransition(() => {
        refreshSlotsForDate(date);
      });
    } else {
      refreshSlotsForDate(date);
    }
  }

  useEffect(() => {
    if (!slotsRequestDate || slotsPending) {
      return;
    }

    const settledForRequest =
      (slotsState?.success && slotsState.data.date === slotsRequestDate) ||
      (slotsState !== null && !slotsState.success);

    if (!settledForRequest) {
      return;
    }

    pauseFullMonthRef.current = false;

    if (slotsState?.success && slotsState.data.date === slotsRequestDate) {
      setSlotsCache((prev) => {
        const incoming = slotsState.data.slots;
        const existing = prev[slotsRequestDate];
        if (
          existing &&
          existing.length === incoming.length &&
          existing.every((slot, index) => slot.startTime === incoming[index]?.startTime)
        ) {
          return prev;
        }
        return { ...prev, [slotsRequestDate]: incoming };
      });

      setDayAvailability((prev) => ({
        ...prev,
        [slotsRequestDate]:
          slotsState.data.slots.length === 0 ? "unavailable" : "available",
      }));

      setSelectedSlot((current) => {
        if (!current) {
          return current;
        }
        const stillAvailable = slotsState.data.slots.some(
          (slot) => slot.startTime === current,
        );
        return stillAvailable ? current : null;
      });
    }

    const { year, month } = viewedMonthRef.current;
    scheduleFullMonthLoad(year, month, FULL_MONTH_RESUME_MS);
  }, [slotsRequestDate, slotsPending, slotsState, scheduleFullMonthLoad]);

  useEffect(() => {
    return () => {
      if (hoverPrefetchTimeoutRef.current) {
        clearTimeout(hoverPrefetchTimeoutRef.current);
      }
      if (fullMonthTimeoutRef.current) {
        clearTimeout(fullMonthTimeoutRef.current);
      }
    };
  }, []);

  const isSlotTaken =
    !!holdState && !holdState.success && holdState.code === "SLOT_TAKEN";
  const effectiveSelectedSlot = isSlotTaken ? null : selectedSlot;

  useEffect(() => {
    if (isSlotTaken && selectedDate) {
      refreshSlotsForDate(selectedDate);
      const [year, month] = selectedDate.split("-").map(Number);
      void loadClosedDatesForMonth(year, month - 1);
      scheduleFullMonthLoad(year, month - 1, 0);
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
    slotsPending;
  const showSlotsError =
    selectedDate !== null &&
    slotsRequestDate === selectedDate &&
    !slotsPending &&
    !!slotsState &&
    !slotsState.success;

  if (holdState?.success) {
    return (
      <div className="rounded-md border border-ectoplasm/40 bg-void-deep p-6 text-bone">
        <h3 className="mb-2 font-[family-name:var(--font-display)] text-2xl text-ectoplasm">
          Slot bloccato
        </h3>
        <p className="text-sm text-bone/70">Reindirizzamento al pagamento…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 min-[550px]:grid min-[550px]:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] min-[550px]:items-start min-[550px]:gap-x-6 min-[550px]:gap-y-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-x-10">
      <form ref={slotsFormRef} action={slotsAction} className="hidden">
        <input type="hidden" name="roomSlug" defaultValue={room.slug} />
        <input type="hidden" name="roomId" defaultValue={room.id} />
        <input ref={dateInputRef} type="hidden" name="date" defaultValue="" />
      </form>

      <div className="min-w-0 w-full min-[550px]:max-w-[17rem] lg:max-w-none">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-bone/60 uppercase">
          1. Scegli una data
        </h2>
        <BookingCalendar
          selectedDate={selectedDate}
          dayAvailability={dayAvailability}
          isLoadingAvailability={isRefiningAvailability}
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
          <p className="text-sm text-blood-bright">{slotsState.error}</p>
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
                    className={`min-w-[5.75rem] rounded border px-5 py-3 text-base transition-colors ${
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
            encType="multipart/form-data"
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
                onChange={setParticipantCount}
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
                    download="liberatoria.pdf"
                    className="rounded border border-void-mist bg-void px-3 py-1.5 text-bone transition-colors hover:border-bone/40"
                  >
                    liberatoria
                  </a>
                  <span className="font-semibold text-blood-bright">
                    ATTENZIONE liberatoria obbligatoria
                  </span>
                </div>
                <p className="text-xs text-bone/60">
                  Scarica il modulo, compilalo e carica una copia per ogni
                  minorenne (PDF, JPG o PNG, max 900 KB).
                </p>
                {Array.from({ length: minorCount }, (_, index) => {
                  const minorNumber = index + 1;
                  return (
                    <label
                      key={minorNumber}
                      className="flex flex-col gap-1 text-sm text-bone/80"
                    >
                      Liberatoria minorenne {minorNumber}
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
                    onChange={() => setPaymentChoice("DEPOSIT")}
                  />
                  Solo caparra
                </span>
                <span className="text-ectoplasm">
                  {previewTier ? `${previewTier.depositPrice} €` : "—"}
                </span>
              </label>
            </fieldset>

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
