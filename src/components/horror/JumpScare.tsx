"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const SESSION_STORAGE_KEY = "cageroom_jumpscare_shown";
const SCROLL_TRIGGER_THRESHOLD = 3;
const INACTIVITY_TRIGGER_MS = 20_000;
const VISIBLE_DURATION_MS = 400;

export function JumpScare() {
  const [visible, setVisible] = useState(false);
  const scrollCountRef = useRef(0);
  const hasTriggeredRef = useRef(false);
  const inactivityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const trigger = useCallback(() => {
    if (hasTriggeredRef.current) return;
    hasTriggeredRef.current = true;

    try {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, "1");
    } catch {
      // sessionStorage non disponibile (es. modalità privata restrittiva):
      // il jump scare potrebbe ripetersi tra i reload, ma non è bloccante.
    }

    // L'audio parte solo se un toggle globale (non ancora presente in questa
    // fase) ha già impostato il flag su true: nessun autoplay forzato.
    try {
      const audioEnabled =
        window.sessionStorage.getItem("cageroom_audio_enabled") === "true";
      if (audioEnabled) {
        new Audio("/sounds/whisper.mp3").play().catch(() => {
          // Riproduzione audio best-effort: eventuali blocchi del browser
          // o file mancante non devono interrompere l'effetto visivo.
        });
      }
    } catch {
      // Ignora: l'effetto visivo resta comunque valido senza audio.
    }

    setVisible(true);
    setTimeout(() => setVisible(false), VISIBLE_DURATION_MS);
  }, []);

  useEffect(() => {
    let alreadyShown = false;
    try {
      alreadyShown =
        window.sessionStorage.getItem(SESSION_STORAGE_KEY) === "1";
    } catch {
      alreadyShown = false;
    }

    if (alreadyShown) {
      hasTriggeredRef.current = true;
      return;
    }

    function resetInactivityTimer() {
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
      }
      inactivityTimeoutRef.current = setTimeout(trigger, INACTIVITY_TRIGGER_MS);
    }

    function handleScroll() {
      scrollCountRef.current += 1;
      resetInactivityTimer();
      if (scrollCountRef.current >= SCROLL_TRIGGER_THRESHOLD) {
        trigger();
      }
    }

    function handleActivity() {
      resetInactivityTimer();
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("mousemove", handleActivity, { passive: true });
    window.addEventListener("keydown", handleActivity);
    resetInactivityTimer();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
      }
    };
  }, [trigger]);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/80"
        >
          <div className="animate-shake text-[14rem] leading-none text-blood-bright drop-shadow-[0_0_40px_rgba(153,0,0,0.9)]">
            👁
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
