"use client";

import { useActionState, useCallback, useState } from "react";
import Link from "next/link";
import { generateDiscountCode, type MaledizioneActionState } from "@/app/_actions/maledizione";

type MaledizioneGameProps = {
  isLoggedIn: boolean;
  discountEnabled: boolean;
  discountPercent: number;
  existingCode: string | null;
};

export function MaledizioneGame({
  isLoggedIn,
  discountEnabled,
  discountPercent,
  existingCode,
}: MaledizioneGameProps) {
  const [torchPos, setTorchPos] = useState({ x: 0, y: 0 });
  const [state, formAction, pending] = useActionState<
    MaledizioneActionState | null,
    FormData
  >(generateDiscountCode, null);

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      setTorchPos({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    },
    [],
  );

  if (!isLoggedIn) {
    return (
      <div className="rounded border border-void-mist bg-void-deep p-8 text-center">
        <p className="text-bone/70">
          Solo chi ha attraversato la soglia può affrontare il rito.
        </p>
        <Link
          href="/login?callbackUrl=/maledizione"
          className="mt-4 inline-block text-blood-bright underline"
        >
          Accedi per continuare
        </Link>
      </div>
    );
  }

  const revealedCode = state?.code ?? existingCode;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-bone/60">
        Muovi il cursore come una torcia. Trova il simbolo nascosto e scrivi la
        tua risposta nel campo sotto.
      </p>

      <div
        className="relative h-72 cursor-crosshair overflow-hidden rounded border border-void-mist bg-black"
        onMouseMove={handleMouseMove}
        style={{
          background: `radial-gradient(circle 90px at ${torchPos.x}px ${torchPos.y}px, rgba(232,226,214,0.15) 0%, rgba(0,0,0,0.95) 70%)`,
        }}
      >
        <p className="absolute inset-0 flex items-center justify-center font-[family-name:var(--font-display)] text-5xl tracking-widest text-bone/5 select-none">
          VIII
        </p>
        <p className="absolute bottom-3 left-3 text-xs text-bone/30">
          …qualcosa brilla al centro
        </p>
      </div>

      {!discountEnabled ? (
        <p className="rounded border border-blood/30 bg-blood/10 px-3 py-2 text-sm text-blood-bright">
          Il rito è sigillato. Nessun codice verrà emesso finché non sarà riaperto
          dagli amministratori.
        </p>
      ) : null}

      {revealedCode ? (
        <div className="rounded border border-ectoplasm/40 bg-ectoplasm/10 p-4 text-center">
          <p className="text-sm text-bone/70">Il tuo codice maledetto:</p>
          <p className="mt-2 font-mono text-2xl text-ectoplasm">{revealedCode}</p>
          <p className="mt-2 text-xs text-bone/50">
            Sconto del {state?.discountPercent ?? discountPercent}% alla prenotazione
          </p>
        </div>
      ) : discountEnabled ? (
        <form action={formAction} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-bone/80">
            Risposta all&apos;enigma
            <input
              name="puzzleAnswer"
              required
              maxLength={50}
              placeholder="Simbolo romano…"
              className="rounded border border-void-mist bg-void px-3 py-2 text-bone"
            />
          </label>
          {state?.error ? (
            <p className="text-sm text-blood-bright">{state.error}</p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-blood px-4 py-2 text-bone hover:bg-blood-bright disabled:opacity-50"
          >
            {pending ? "Il rito procede…" : "Completa il rito"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
