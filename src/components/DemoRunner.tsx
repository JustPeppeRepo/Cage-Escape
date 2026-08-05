"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

const ROOM_PATH = "/rooms/la-macelleria";
const ROOMS_LIST_PATH = "/rooms";
const TARGET_DATE = "2026-07-31";
const TARGET_DATE_ARIA = "31 Luglio 2026";

/**
 * Metti a `true` solo quando registri lo schermo.
 * Con `false` il codice resta montato ma non parte (né da soli né da tastiera).
 */
const DEMO_RUNNER_ACTIVE = false;

/** easeInOutCubic — pieno controllo accelerazione/decelerazione */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Rampe accel/decel corte (ease-in/out quadratiche) + crociera a velocità costante.
 * Mantiene la velocità di crociera simile al tratto centrale, ma entra/esce più snella.
 */
function easeInOutCruise(t: number, easePortion = 0.12): number {
  const a = Math.min(0.45, Math.max(0.05, easePortion));
  const v = 1 / (1 - a);
  if (t <= a) {
    const u = t / a;
    return 0.5 * v * a * u * u;
  }
  if (t >= 1 - a) {
    const u = (1 - t) / a;
    return 1 - 0.5 * v * a * u * u;
  }
  return 0.5 * v * a + v * (t - a);
}

function getMaxScrollY(): number {
  return Math.max(
    0,
    document.documentElement.scrollHeight - window.innerHeight,
  );
}

function clampScrollY(y: number): number {
  return Math.min(getMaxScrollY(), Math.max(0, y));
}

function smoothScrollTo(
  targetY: number,
  duration: number,
  onFrame?: (id: number) => void,
  easing: (t: number) => number = easeInOutCubic,
): Promise<void> {
  return new Promise((resolve) => {
    const startY = window.scrollY;
    const endY = clampScrollY(targetY);
    const delta = endY - startY;
    if (Math.abs(delta) < 1 || duration <= 0) {
      window.scrollTo(0, endY);
      resolve();
      return;
    }

    const startTime = performance.now();

    function step(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const eased = easing(t);
      // Clamp frame-per-frame: evita lo "sbattimento" se l'altezza pagina cambia
      window.scrollTo(0, clampScrollY(startY + delta * eased));

      if (t < 1) {
        const id = requestAnimationFrame(step);
        onFrame?.(id);
      } else {
        window.scrollTo(0, endY);
        resolve();
      }
    }

    const id = requestAnimationFrame(step);
    onFrame?.(id);
  });
}

/**
 * Compila un input aggiornando lo stato interno di React
 * (native value setter + evento input bubbling).
 */
function setNativeInputValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  const proto =
    element instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

async function typeIntoField(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
  delayMs: number,
  schedule: (fn: () => void, ms: number) => void,
): Promise<void> {
  element.focus();
  setNativeInputValue(element, "");

  for (let i = 0; i < value.length; i += 1) {
    await new Promise<void>((resolve) => {
      schedule(() => {
        setNativeInputValue(element, value.slice(0, i + 1));
        resolve();
      }, delayMs);
    });
  }
}

function clickElement(el: Element | null): boolean {
  if (!(el instanceof HTMLElement) || el.hasAttribute("disabled")) {
    return false;
  }
  el.click();
  return true;
}

function findDateButton(): HTMLElement | null {
  const byData = document.querySelector<HTMLElement>(
    `button[data-date="${TARGET_DATE}"]`,
  );
  if (byData && !byData.hasAttribute("disabled")) return byData;

  const byAria = document.querySelector<HTMLElement>(
    `button[aria-label="${TARGET_DATE_ARIA}"]`,
  );
  if (byAria && !byAria.hasAttribute("disabled")) return byAria;

  return null;
}

function findAvailableSlotButtons(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>("button[type='button']"),
  ).filter((btn) => {
    if (btn.hasAttribute("disabled") || btn.dataset.date) return false;
    // Slot orari: es. "18:00 – 19:30"
    return /\d{1,2}:\d{2}\s*[–-]\s*\d{1,2}:\d{2}/.test(
      btn.textContent?.trim() ?? "",
    );
  });
}

function findBookingSubmitButton(): HTMLElement | null {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>("button[type='submit']"),
  );
  return (
    candidates.find((btn) =>
      /blocca questo slot|conferma|prenota/i.test(btn.textContent ?? ""),
    ) ?? null
  );
}

function findParticipantIncreaseButton(): HTMLButtonElement | null {
  const labels = Array.from(document.querySelectorAll("label"));
  const participantsLabel = labels.find((label) =>
    /numero partecipanti/i.test(label.textContent ?? ""),
  );
  return (
    participantsLabel?.querySelector<HTMLButtonElement>(
      'button[aria-label="Aumenta"]',
    ) ?? null
  );
}

function getParticipantCount(): number | null {
  const labels = Array.from(document.querySelectorAll("label"));
  const participantsLabel = labels.find((label) =>
    /numero partecipanti/i.test(label.textContent ?? ""),
  );
  const output = participantsLabel?.querySelector("output");
  if (!output) return null;
  const value = Number.parseInt(output.textContent?.trim() ?? "", 10);
  return Number.isFinite(value) ? value : null;
}

function findDepositPaymentOption(): HTMLElement | null {
  const radio = document.querySelector<HTMLInputElement>(
    'input[type="radio"][name="paymentChoice"][value="DEPOSIT"]',
  );
  if (radio) return radio;
  return (
    Array.from(document.querySelectorAll("label")).find((label) =>
      /blocca la prenotazione/i.test(label.textContent ?? ""),
    ) ?? null
  );
}

function findContactFields(): {
  name?: HTMLInputElement;
  email?: HTMLInputElement;
  phone?: HTMLInputElement;
} {
  const name =
    document.querySelector<HTMLInputElement>(
      'input[name="name"], input[name="nome"], input[autocomplete="name"]',
    ) ?? undefined;
  const email =
    document.querySelector<HTMLInputElement>(
      'input[type="email"], input[name="email"]',
    ) ?? undefined;
  const phone =
    document.querySelector<HTMLInputElement>(
      'input[type="tel"], input[name="phone"], input[name="telefono"]',
    ) ?? undefined;
  return { name, email, phone };
}

function waitFor(
  predicate: () => boolean,
  schedule: (fn: () => void, ms: number) => void,
  timeoutMs = 15_000,
  intervalMs = 200,
): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now();

    function poll() {
      if (predicate()) {
        resolve(true);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        resolve(false);
        return;
      }
      schedule(poll, intervalMs);
    }

    poll();
  });
}

/**
 * Automazione locale per registrazione video del flusso prenotazione.
 * Attivo solo in development e se `DEMO_RUNNER_ACTIVE` è true.
 */
export function DemoRunner() {
  const pathname = usePathname();
  const router = useRouter();
  const cancelledRef = useRef(false);
  const timeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const rafIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    // Scollegato: codice conservato, nessun avvio automatico / tastiera.
    if (!DEMO_RUNNER_ACTIVE || process.env.NODE_ENV !== "development") {
      return;
    }

    cancelledRef.current = false;

    const trackRaf = (id: number) => {
      rafIdsRef.current.add(id);
    };

    const schedule = (fn: () => void, ms: number) => {
      const id = setTimeout(() => {
        timeoutsRef.current.delete(id);
        if (!cancelledRef.current) fn();
      }, ms);
      timeoutsRef.current.add(id);
    };

    const cleanup = () => {
      cancelledRef.current = true;
      for (const id of timeoutsRef.current) clearTimeout(id);
      timeoutsRef.current.clear();
      for (const id of rafIdsRef.current) cancelAnimationFrame(id);
      rafIdsRef.current.clear();
    };

    // Fase 3: fuori dalle rotte demo → ferma tutto
    const isDemoRoute =
      pathname === "/" ||
      pathname === ROOMS_LIST_PATH ||
      pathname === ROOM_PATH ||
      pathname.startsWith("/checkout");

    if (
      !isDemoRoute ||
      pathname.includes("stripe.com") ||
      (typeof window !== "undefined" &&
        window.location.hostname.includes("stripe"))
    ) {
      cleanup();
      return cleanup;
    }

    // Prefetch a cascata per transizioni istantanee
    if (pathname === "/") {
      router.prefetch(ROOMS_LIST_PATH);
      router.prefetch(ROOM_PATH);
    } else if (pathname === ROOMS_LIST_PATH) {
      router.prefetch(ROOM_PATH);
    }

    async function runHomePhase() {
      await new Promise<void>((resolve) => schedule(resolve, 1000));
      if (cancelledRef.current) return;

      const targetY = getMaxScrollY();
      // Stessa velocità di crociera di prima; rampe ingresso/uscita più snelle
      const duration = Math.min(28_000, Math.max(13_000, targetY * 3.3));
      await smoothScrollTo(targetY, duration, trackRaf, (t) =>
        easeInOutCruise(t, 0.2),
      );
      if (cancelledRef.current) return;

      await new Promise<void>((resolve) => schedule(resolve, 500));
      if (cancelledRef.current) return;

      router.push(ROOMS_LIST_PATH);
    }

    async function runRoomsListPhase() {
      router.prefetch(ROOM_PATH);

      await new Promise<void>((resolve) => schedule(resolve, 400));
      if (cancelledRef.current) return;

      // Piccolo scroll fluido easeInOut sulla lista stanze
      await smoothScrollTo(window.scrollY + 320, 1600, trackRaf, easeInOutCubic);
      if (cancelledRef.current) return;

      await new Promise<void>((resolve) => schedule(resolve, 600));
      if (cancelledRef.current) return;

      router.push(ROOM_PATH);
    }

    async function runRoomPhase() {
      window.scrollTo(0, 0);

      // Appena il calendario è pronto, hover/focus sulla data per precaricare gli slot
      // (BookingWidget prefetcha su onDayHover con ~80ms di delay).
      const dateReady = await waitFor(
        () => findDateButton() !== null,
        schedule,
      );
      if (cancelledRef.current || !dateReady) return;

      const dateBtn = findDateButton();
      if (dateBtn) {
        dateBtn.dispatchEvent(
          new MouseEvent("mouseenter", { bubbles: true, cancelable: true }),
        );
        dateBtn.focus();
      }

      await new Promise<void>((resolve) => schedule(resolve, 1000));
      if (cancelledRef.current) return;

      clickElement(findDateButton());

      // Attendi comparsa slot (già in cache se il prefetch è andato a buon fine)
      const slotsReady = await waitFor(
        () => findAvailableSlotButtons().length > 0,
        schedule,
      );
      if (cancelledRef.current || !slotsReady) return;

      // Seleziona uno slot solo dopo 1s dalla comparsa
      await new Promise<void>((resolve) => schedule(resolve, 1000));
      if (cancelledRef.current) return;

      const slots = findAvailableSlotButtons();
      const randomSlot = slots[Math.floor(Math.random() * slots.length)];
      clickElement(randomSlot ?? null);

      // Attendi il form, poi scroll verso di esso (target clampato → uscita fluida)
      await waitFor(() => findParticipantIncreaseButton() !== null, schedule);
      if (cancelledRef.current) return;

      await new Promise<void>((resolve) => schedule(resolve, 200));
      if (cancelledRef.current) return;

      const formEl =
        findParticipantIncreaseButton()?.closest("form") ??
        document.querySelector("form");
      const formTarget =
        formEl instanceof HTMLElement
          ? formEl.getBoundingClientRect().top + window.scrollY - 72
          : window.scrollY + 400;

      await smoothScrollTo(formTarget, 3000, trackRaf, easeInOutCubic);
      if (cancelledRef.current) return;

      await new Promise<void>((resolve) => schedule(resolve, 800));
      if (cancelledRef.current) return;

      // Aumenta partecipanti fino a 5 (click sullo stepper "Aumenta")
      const formReady = await waitFor(
        () => findParticipantIncreaseButton() !== null,
        schedule,
      );
      if (cancelledRef.current || !formReady) return;

      while (!cancelledRef.current) {
        const current = getParticipantCount();
        if (current !== null && current >= 5) break;
        const increaseBtn = findParticipantIncreaseButton();
        if (!increaseBtn || increaseBtn.disabled) break;
        clickElement(increaseBtn);
        await new Promise<void>((resolve) => schedule(resolve, 350));
      }
      if (cancelledRef.current) return;

      await new Promise<void>((resolve) => schedule(resolve, 500));
      if (cancelledRef.current) return;

      // Seleziona "Blocca la prenotazione" (caparra / DEPOSIT)
      clickElement(findDepositPaymentOption());

      await new Promise<void>((resolve) => schedule(resolve, 600));
      if (cancelledRef.current) return;

      const fields = findContactFields();
      if (fields.name) {
        await typeIntoField(fields.name, "Mario Rossi", 40, schedule);
      }
      if (cancelledRef.current) return;
      if (fields.email) {
        await typeIntoField(fields.email, "mario.rossi@example.com", 30, schedule);
      }
      if (cancelledRef.current) return;
      if (fields.phone) {
        await typeIntoField(fields.phone, "3331234567", 40, schedule);
      }
      if (cancelledRef.current) return;

      await new Promise<void>((resolve) => schedule(resolve, 1000));
      if (cancelledRef.current) return;

      const submitReady = await waitFor(
        () => findBookingSubmitButton() !== null,
        schedule,
        8_000,
      );
      if (cancelledRef.current || !submitReady) return;
      clickElement(findBookingSubmitButton());
    }

    async function runCheckoutPhase() {
      // Completa il redirect Stripe per la registrazione video
      await new Promise<void>((resolve) => schedule(resolve, 1000));
      if (cancelledRef.current) return;

      const payBtn = await waitFor(() => {
        const btn = Array.from(
          document.querySelectorAll<HTMLElement>("button[type='submit']"),
        ).find((el) =>
          /procedi al pagamento|stripe/i.test(el.textContent ?? ""),
        );
        return !!btn && !btn.hasAttribute("disabled");
      }, schedule);

      if (cancelledRef.current || !payBtn) return;

      const button = Array.from(
        document.querySelectorAll<HTMLElement>("button[type='submit']"),
      ).find((el) =>
        /procedi al pagamento|stripe/i.test(el.textContent ?? ""),
      );
      clickElement(button ?? null);
    }

    if (pathname === "/") {
      void runHomePhase();
    } else if (pathname === ROOMS_LIST_PATH) {
      void runRoomsListPhase();
    } else if (pathname === ROOM_PATH) {
      void runRoomPhase();
    } else if (pathname.startsWith("/checkout")) {
      void runCheckoutPhase();
    }

    return cleanup;
  }, [pathname, router]);

  return null;
}
