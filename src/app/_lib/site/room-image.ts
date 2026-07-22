import { existsSync } from "node:fs";
import path from "node:path";

/** Path pubblico della cover stanza, o null se il file non esiste in /public. */
export function getRoomImageSrc(slug: string): string | null {
  const filename = `${slug}.jpg`;
  const absPath = path.join(process.cwd(), "public", "rooms", filename);
  return existsSync(absPath) ? `/rooms/${filename}` : null;
}
