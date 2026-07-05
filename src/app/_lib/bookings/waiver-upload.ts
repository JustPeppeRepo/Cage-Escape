export const WAIVER_MAX_BYTES = 900 * 1024;

export const WAIVER_ACCEPT =
  "application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png";

const ALLOWED_WAIVER_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

type AllowedWaiverMime = (typeof ALLOWED_WAIVER_MIME_TYPES)[number];

export type ValidatedWaiver = {
  minorIndex: number;
  fileName: string;
  mimeType: AllowedWaiverMime;
  sizeBytes: number;
  content: Buffer;
};

export function sanitizeWaiverFileName(raw: string): string {
  const base = raw.split(/[/\\]/).pop() ?? "liberatoria";
  const sanitized = base.replace(/[^\w.\-() ]+/g, "_").trim();
  const trimmed = sanitized.slice(0, 100);
  return trimmed.length > 0 ? trimmed : "liberatoria.pdf";
}

export function detectWaiverMime(buffer: Buffer): AllowedWaiverMime | null {
  if (
    buffer.length >= 4 &&
    buffer.subarray(0, 4).toString("ascii") === "%PDF"
  ) {
    return "application/pdf";
  }

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  return null;
}

function isAllowedDeclaredMime(type: string): type is AllowedWaiverMime {
  return (ALLOWED_WAIVER_MIME_TYPES as readonly string[]).includes(type);
}

export async function validateWaiverFile(
  file: File,
  minorIndex: number,
): Promise<
  { ok: true; waiver: ValidatedWaiver } | { ok: false; error: string }
> {
  if (!(file instanceof File) || file.size === 0) {
    return {
      ok: false,
      error: `Carica la liberatoria per il minorenne ${minorIndex}`,
    };
  }

  if (file.size > WAIVER_MAX_BYTES) {
    return {
      ok: false,
      error: `La liberatoria del minorenne ${minorIndex} supera il limite di 900 KB`,
    };
  }

  const declaredType = file.type.toLowerCase();
  if (!isAllowedDeclaredMime(declaredType)) {
    return {
      ok: false,
      error: `Formato non valido per il minorenne ${minorIndex}. Usa PDF, JPG o PNG.`,
    };
  }

  const content = Buffer.from(await file.arrayBuffer());
  const detectedMime = detectWaiverMime(content);

  if (!detectedMime) {
    return {
      ok: false,
      error: `Il file del minorenne ${minorIndex} non è un documento valido`,
    };
  }

  if (detectedMime !== declaredType) {
    return {
      ok: false,
      error: `Il contenuto del file del minorenne ${minorIndex} non corrisponde al formato dichiarato`,
    };
  }

  return {
    ok: true,
    waiver: {
      minorIndex,
      fileName: sanitizeWaiverFileName(file.name),
      mimeType: detectedMime,
      sizeBytes: content.length,
      content,
    },
  };
}

export async function validateWaiverFiles(
  formData: FormData,
  minorCount: number,
): Promise<
  { ok: true; waivers: ValidatedWaiver[] } | { ok: false; error: string }
> {
  if (minorCount === 0) {
    for (const [key, entry] of formData.entries()) {
      if (key.startsWith("waiver_") && entry instanceof File && entry.size > 0) {
        return {
          ok: false,
          error: "Liberatoria non richiesta se non ci sono minorenni",
        };
      }
    }

    return { ok: true, waivers: [] };
  }

  const waivers: ValidatedWaiver[] = [];

  for (let minorIndex = 1; minorIndex <= minorCount; minorIndex++) {
    const entry = formData.get(`waiver_${minorIndex}`);
    if (!(entry instanceof File)) {
      return {
        ok: false,
        error: `Carica la liberatoria per il minorenne ${minorIndex}`,
      };
    }

    const result = await validateWaiverFile(entry, minorIndex);
    if (!result.ok) {
      return result;
    }

    waivers.push(result.waiver);
  }

  return { ok: true, waivers };
}
