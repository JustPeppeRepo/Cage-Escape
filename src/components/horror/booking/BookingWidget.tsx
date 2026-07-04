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
  getMonthAvailability,
  holdSlot,
} from "@/app/_actions/bookings";
import type {
  DayAvailabilityStatus,
  SerializedTimeSlot,
} from "@/app/_lib/bookings/slots";
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
    id: string;
    slug: string;
    minPlayers: number;
    maxPlayers: number;
    durationMinutes: number;
  };
  pricingTiers: PricingTierPreview[];
  initialDayAvailability: Record<string, DayAvailabilityStatus>;
  initialSlotsByDate: Record<string, SerializedTimeSlot[]>;
  prefetchedRangeStart: string;
  prefetchedRangeEnd: string;
};

const TIME_FORMATTER = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome",
  hour: "2-digit",
  minute: "2-digit",
});

const HOVER_PREFETCH_DELAY_MS = 150;

function formatSlotTime(iso: string): string {
  return TIME_FORMATTER.format(new Date(iso));
}

function padMonth(month: number): string {
  return String(month + 1).padStart(2, "0");
}

function monthHasAvailabilityData(
  dayAvailability: Record<string, DayAvailabilityStatus>,
  year: number,
  month: number,
): boolean {
  const prefix = `${year}-${padMonth(month)}-`;
  return Object.keys(dayAvailability).some((date) => date.startsWith(prefix));
}

function slotsEqual(
  left: SerializedTimeSlot[],
  right: SerializedTimeSlot[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every(
    (slot, index) =>
      slot.startTime === right[index]?.startTime &&
      slot.endTime === right[index]?.endTime,
  );
}

export function BookingWidget({
  room,
  pricingTiers,
  initialDayAvailability,
  initialSlotsByDate,
  prefetchedRangeStart: _prefetchedRangeStart,
  prefetchedRangeEnd: _prefetchedRangeEnd,
}: BookingWidgetProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [dayAvailability, setDayAvailability] = useState(
    initialDayAvailability,
  );
  const [slotsCache, setSlotsCache] = useState(initialSlotsByDate);
  const [slotsRequestDate, setSlotsRequestDate] = useState<string | null>(
    null,
  );
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [participantCount, setParticipantCount] = useState(room.minPlayers);
  const [minorCount, setMinorCount] = useState(0);
  const [discountCode, setDiscountCode] = useState("");
  const [paymentChoice, setPaymentChoice] = useState<"FULL" | "DEPOSIT">(
    "FULL",
  );

  const dateInputRef = useRef<HTMLInputElement>(null);
  const slotsFormRef = useRef<HTMLFormElement>(null);
  const availabilityRequestRef = useRef(0);
  const slotsRequestRef = useRef(0);
  const hoverPrefetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const hoverPrefetchInFlightRef = useRef<Set<string>>(new Set());
  const loadedMonthsRef = useRef<Set<string>>(new Set());
  const slotsCacheRef = useRef(initialSlotsByDate);

  useEffect(() => {
    slotsCacheRef.current = slotsCache;
  }, [slotsCache]);

  const loadMonthAvailability = useCallback(
    async (year: number, month: number) => {
      const monthKey = `${year}-${padMonth(month)}`;
      if (loadedMonthsRef.current.has(monthKey)) {
        return;
      }

      const requestId = availabilityRequestRef.current + 1;
      availabilityRequestRef.current = requestId;
      setIsLoadingAvailability(true);

      const formData = new FormData();
      formData.set("roomSlug", room.slug);
      formData.set("year", String(year));
      formData.set("month", String(month + 1));

      try {
        const result = await getMonthAvailability(null, formData);
        if (
          availabilityRequestRef.current !== requestId ||
          !result.success
        ) {
          return;
        }

        loadedMonthsRef.current.add(monthKey);
        setDayAvailability((current) => ({ ...current, ...result.data.days }));
      } finally {
        if (availabilityRequestRef.current === requestId) {
          setIsLoadingAvailability(false);
        }
      }
    },
    [room.slug],
  );

  const handleMonthChange = useCallback(
    (year: number, month: number) => {
      if (monthHasAvailabilityData(dayAvailability, year, month)) {
        return;
      }

      void loadMonthAvailability(year, month);
    },
    [dayAvailability, loadMonthAvailability],
  );

  const refreshSlotsForDate = useCallback((date: string) => {
    const requestId = slotsRequestRef.current + 1;
    slotsRequestRef.current = requestId;
    setSlotsRequestDate(date);

    if (dateInputRef.current) {
      dateInputRef.current.value = date;
    }
    slotsFormRef.current?.requestSubmit();
  }, []);

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

        setSlotsCache((current) => {
          if (current[date] !== undefined) {
            return current;
          }

          return { ...current, [date]: result.data.slots };
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
  const [holdState, holdAction, holdPending] = useActionState(
    holdSlot,
    null,
  );

  function handleSelectDate(date: string) {
    setSelectedDate(date);
    setSelectedSlot(null);
    refreshSlotsForDate(date);
  }

  useEffect(() => {
    if (!slotsState?.success || !slotsRequestDate) {
      return;
    }

    if (slotsState.data.date !== slotsRequestDate) {
      return;
    }

    setSlotsCache((current) => {
      const previous = current[slotsRequestDate];
      if (previous && slotsEqual(previous, slotsState.data.slots)) {
        return current;
      }

      return { ...current, [slotsRequestDate]: slotsState.data.slots };
    });

    setSelectedSlot((current) => {
      if (!current) {
        return current;
      }

      const stillAvailable = slotsState.data.slots.some(
        (slot) => slot.startTime === current,
      );
      return stillAvailable ? current : null;
    });
  }, [slotsRequestDate, slotsState]);

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

  useEffect(() => {
    if (isSlotTaken && selectedDate) {
      refreshSlotsForDate(selectedDate);
      const [year, month] = selectedDate.split("-").map(Number);
      void loadMonthAvailability(year, month - 1);
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
        <p className="text-sm text-bone/70">
          Reindirizzamento al pagamento…
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-x-10 lg:gap-y-6">
      <form ref={slotsFormRef} action={slotsAction} className="hidden">
        <input type="hidden" name="roomSlug" defaultValue={room.slug} />
        <input type="hidden" name="roomId" defaultValue={room.id} />
        <input ref={dateInputRef} type="hidden" name="date" defaultValue="" />
      </form>

      <div className="min-w-0 w-full">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-bone/60 uppercase">
          1. Scegli una data
        </h2>
        <BookingCalendar
          selectedDate={selectedDate}
          dayAvailability={dayAvailability}
          isLoadingAvailability={isLoadingAvailability}
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
