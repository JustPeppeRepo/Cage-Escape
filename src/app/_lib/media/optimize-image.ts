import sharp from "sharp";
import { MEDIA_MAX_UPLOAD_BYTES } from "@/app/_lib/media/constants";

export { MEDIA_ACCEPT, MEDIA_MAX_UPLOAD_BYTES } from "@/app/_lib/media/constants";

const ALLOWED_IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

type AllowedImageMime = (typeof ALLOWED_IMAGE_MIMES)[number];

function isAllowedDeclaredMime(type: string): type is AllowedImageMime {
  return (ALLOWED_IMAGE_MIMES as readonly string[]).includes(type);
}

function detectImageMime(buffer: Buffer): AllowedImageMime | null {
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

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

export type OptimizeImageOptions = {
  maxWidth: number;
  quality?: number;
};

export type OptimizeImageResult =
  | { ok: true; webp: Buffer }
  | { ok: false; error: string };

/** Valida JPG/PNG/WebP e ricodifica in WebP ridimensionato (no Image Optimization Vercel). */
export async function optimizeUploadedImage(
  file: File,
  options: OptimizeImageOptions,
): Promise<OptimizeImageResult> {
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Seleziona un'immagine" };
  }

  if (file.size > MEDIA_MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: "Immagine troppo grande (max 4 MB). Comprimila e riprova.",
    };
  }

  const declaredType = file.type.toLowerCase();
  if (!isAllowedDeclaredMime(declaredType)) {
    return { ok: false, error: "Formato non valido. Usa JPG, PNG o WebP." };
  }

  const input = Buffer.from(await file.arrayBuffer());
  const detected = detectImageMime(input);
  if (!detected) {
    return { ok: false, error: "Il file non è un'immagine valida" };
  }

  if (detected !== declaredType) {
    return {
      ok: false,
      error: "Il contenuto del file non corrisponde al formato dichiarato",
    };
  }

  try {
    const webp = await sharp(input)
      .rotate()
      .resize({
        width: options.maxWidth,
        withoutEnlargement: true,
      })
      .webp({ quality: options.quality ?? 80 })
      .toBuffer();

    return { ok: true, webp };
  } catch (error) {
    console.error("[media/optimizeUploadedImage]", error);
    return { ok: false, error: "Impossibile elaborare l'immagine" };
  }
}
