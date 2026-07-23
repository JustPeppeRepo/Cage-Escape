"use client";

import Image from "next/image";
import { useRef, useState, useTransition, type ChangeEvent } from "react";
import {
  MEDIA_ACCEPT,
  MEDIA_MAX_UPLOAD_BYTES,
} from "@/app/_lib/media/optimize-image";
import {
  adminButtonClassName,
  adminLabelClassName,
  adminSecondaryButtonClassName,
} from "@/components/admin/AdminFormFeedback";

type MediaUploadFieldProps = {
  uploadUrl: string;
  currentImageUrl: string | null;
  label?: string;
  hint?: string;
};

export function MediaUploadField({
  uploadUrl,
  currentImageUrl,
  label = "Immagine di copertina",
  hint = "JPG, PNG o WebP · max 4 MB · verrà convertita in WebP ottimizzato",
}: MediaUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function resetFileInput() {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError(null);
    setMessage(null);

    if (file.size > MEDIA_MAX_UPLOAD_BYTES) {
      setError("Immagine troppo grande (max 4 MB)");
      resetFileInput();
      return;
    }

    startTransition(async () => {
      const body = new FormData();
      body.append("file", file);

      try {
        const response = await fetch(uploadUrl, {
          method: "POST",
          body,
        });
        const payload = (await response.json()) as {
          ok?: boolean;
          error?: string;
          imageUrl?: string;
        };

        if (!response.ok || !payload.ok || !payload.imageUrl) {
          setError(payload.error ?? "Upload non riuscito");
          resetFileInput();
          return;
        }

        setPreviewUrl(payload.imageUrl);
        setMessage("Immagine aggiornata");
      } catch {
        setError("Errore di rete durante l'upload");
      } finally {
        resetFileInput();
      }
    });
  }

  function onRemove() {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch(uploadUrl, { method: "DELETE" });
        const payload = (await response.json()) as {
          ok?: boolean;
          error?: string;
        };

        if (!response.ok || !payload.ok) {
          setError(payload.error ?? "Eliminazione non riuscita");
          return;
        }

        setPreviewUrl(null);
        setMessage("Immagine rimossa");
      } catch {
        setError("Errore di rete durante l'eliminazione");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded border border-void-mist p-4">
      <div>
        <p className={adminLabelClassName}>{label}</p>
        <p className="mt-1 text-xs text-bone/50">{hint}</p>
      </div>

      {previewUrl ? (
        <div className="relative aspect-16/10 w-full max-w-sm overflow-hidden rounded bg-void">
          <Image
            src={previewUrl}
            alt=""
            fill
            unoptimized
            className="object-cover"
            sizes="400px"
          />
        </div>
      ) : (
        <p className="text-sm text-bone/50">Nessuna immagine caricata</p>
      )}

      <div className="flex flex-wrap gap-3">
        <label className={`${adminButtonClassName} cursor-pointer`}>
          {pending ? "Elaborazione…" : previewUrl ? "Sostituisci" : "Carica"}
          <input
            ref={inputRef}
            type="file"
            accept={MEDIA_ACCEPT}
            className="sr-only"
            disabled={pending}
            onChange={onFileChange}
          />
        </label>
        {previewUrl ? (
          <button
            type="button"
            disabled={pending}
            onClick={onRemove}
            className={adminSecondaryButtonClassName}
          >
            Rimuovi
          </button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-blood-bright">{error}</p> : null}
      {message ? <p className="text-sm text-ectoplasm/80">{message}</p> : null}
    </div>
  );
}
