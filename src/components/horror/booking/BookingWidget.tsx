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
  holdSlot,
} from "@/app/_actions/bookings";
import type { DayAvailabilityStatus, SerializedTimeSlot } from "@/app/_lib/bookings/slots";
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

function monthKey(year: number, month: number): string {
  return `${year}-${padMonth(month)}`;
}

export function BookingWidget({ room, pricingTiers }: BookingWidgetProps) {
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [dayAvailability, setDayAvailability] = useState<Record<string, DayAvailabilityStatus>>({});
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [slotsCache, setSlotsCache] = useState<Record<string, SerializedTimeSlot[]>>({});
  const [slotsRequestDate, setSlotsRequestDate] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState(room.minPlayers);
  const [minorCount, setMinorCount] = useState(0);
  const [discountCode, setDiscountCode] = useState("");
  const [paymentChoice, setPaymentChoice] = useState<"FULL" | "DEPOSIT">("FULL");

  const dateInputRef = useRef<HTMLInputElement>(null);
  const slotsFormRef = useRef<HTMLFormElement>(null);
  const availabilityRequestRef = useRef(0);
  const loadedMonthsRef = useRef(new Set<string>());
  const hoverPrefetchInFlightRef = useRef(new Set<string>());
  const hoverPrefetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slotsCacheRef = useRef(slotsCache);
  useEffect(() => { slotsCacheRef.current = slotsCache; }, [slotsCache]);

  const loadMonthAvailability = useCallback(async (year: number, month: number) => {
    const key = monthKey(year, month);
    if (loadedMonthsRef.current.has(key)) return;

    const requestId = availabilityRequestRef.current + 1;
    availabilityRequestRef.current = requestId;
    setIsLoadingAvailability(true);

    const formData = new FormData();
    formData.set("roomSlug", room.slug);
    formData.set("year", String(year));
    formData.set("month", String(month + 1));

    try {
      const result = await getMonthAvailability(null, formData);
      if (availabilityRequestRef.current !== requestId || !result.success) return;
      loadedMonthsRef.current.add(key);
      setDayAvailability((prev) => ({ ...prev, ...result.data.days }));
    } finally {
      if (availabilityRequestRef.current === requestId) {
        setIsLoadingAvailability(false);
      }
    }
  }, [room.slug]);

  // Stable ref so BookingCalendar's useEffect doesn't re-fire when dayAvailability updates
  const loadMonthAvailabilityRef = useRef(loadMonthAvailability);
  useEffect(() => { loadMonthAvailabilityRef.current = loadMonthAvailability; }, [loadMonthAvailability]);

  const handleMonthChange = useCallback((year: number, month: number) => {
    void loadMonthAvailabilityRef.current(year, month);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prefetchSlotsForDate = useCallback(async (date: string) => {
    if (slotsCacheRef.current[date] !== undefined) return;
    if (hoverPrefetchInFlightRef.current.has(date)) return;
    hoverPrefetchInFlightRef.current.add(date);

    const formData = new FormData();
    formData.set("roomSlug", room.slug);
    formData.set("roomId", room.id);
    formData.set("date", date);

    try {
      const result = await getAvailableSlots(null, formData);
      if (!result.success || result.data.date !== date) return;
      setSlotsCache((prev) => {
        if (prev[date] !== undefined) return prev;
        return { ...prev, [date]: result.data.slots };
      });
    } finally {
      hoverPrefetchInFlightRef.current.delete(date);
    }
  }, [room.id, room.slug]);

  const handleDayHover = useCallback((date: string) => {
    if (hoverPrefetchTimeoutRef.current) clearTimeout(hoverPrefetchTimeoutRef.current);
    hoverPrefetchTimeoutRef.current = setTimeout(() => {
      void prefetchSlotsForDate(date);
    }, HOVER_PREFETCH_DELAY_MS);
  }, [prefetchSlotsForDate]);

  const [slotsState, slotsAction, slotsPending] = useActionState(getAvailableSlots, null);
  const [holdState, holdAction, holdPending] = useActionState(holdSlot, null);

  function refreshSlotsForDate(date: string) {
    setSlotsRequestDate(date);
    if (dateInputRef.current) dateInputRef.current.value = date;
    slotsFormRef.current?.requestSubmit();
  }

  function handleSelectDate(date: string) {
    setSelectedDate(date);
    setSelectedSlot(null);

    if (slotsCacheRef.current[date] !== undefined) {
      setSlotsRequestDate(date);
      // Still fire background refresh to catch concurrent holds
      startTransition(() => { refreshSlotsForDate(date); });
    } else {
      refreshSlotsForDate(date);
    }
  }

  // Update cache from background/foreground refresh
  useEffect(() => {
    if (!slotsState?.success || !slotsRequestDate) return;
    if (slotsState.data.date !== slotsRequestDate) return;

    setSlotsCache((prev) => {
      const incoming = slotsState.data.slots;
      const existing = prev[slotsRequestDate];
      if (
        existing &&
        existing.length === incoming.length &&
        existing.every((s, i) => s.startTime === incoming[i]?.startTime)
      ) {
        return prev;
      }
      return { ...prev, [slotsRequestDate]: incoming };
    });

    // Deselect slot if it disappeared
    setSelectedSlot((current) => {
      if (!current) return current;
      const stillAvailable = slotsState.data.slots.some((s) => s.startTime === current);
      return stillAvailable ? current : null;
    });
  }, [slotsRequestDate, slotsState]);

  // Cleanup hover timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverPrefetchTimeoutRef.current) clearTimeout(hoverPrefetchTimeoutRef.current);
    };
  }, []);

  const isSlotTaken = !!holdState && !holdState.success && holdState.code === "SLOT_TAKEN";
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

  const cachedSlotsForSelectedDate = selectedDate !== null ? slotsCache[selectedDate] : undefined;
  // Show slots section when we have data for the currently selected date
  const showSlotsSection =
    selectedDate !== null &&
    slotsRequestDate === selectedDate &&
    cachedSlotsForSelectedDate !== undefined;
  // Show loader only when no cached data and actively fetching for this date
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
            <input type="hidden" name="startTime" value={effectiveSelectedSlot} readOnly />

            <label className="flex flex-col gap-1 text-sm text-bone/80">
              Numero partecipanti ({room.minPlayers}-{room.maxPlayers})
              <input
                type="number"
                name="participantCount"
                min={room.minPlayers}
                max={room.maxPlayers}
                value={participantCount}
                onChange={(e) => setParticipantCount(Number(e.target.value))}
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
                onChange={(e) => setMinorCount(Number(e.target.value))}
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
                onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                placeholder="RITO-XXXX-XXXX"
                className="rounded border border-void-mist bg-void px-3 py-2 text-bone uppercase"
              />
            </label>

            {!previewTier ? (
              <p className="text-sm text-blood-bright">
                Nessuna fascia di prezzo disponibile per questo numero di partecipanti.
              </p>
            ) : null}

            {holdState && !holdState.success ? (
              <p className="text-sm text-blood-bright">
                {holdState.error}
                {holdState.code === "UNAUTHORIZED" ? (
                  <> <a href="/login" className="underline">Accedi</a></>
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
