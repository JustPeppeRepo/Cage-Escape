// Impedisce un open redirect tramite il parametro callbackUrl: accetta solo
// path relativi interni allo stesso host ("/qualcosa"), mai URL assoluti
// ("scheme://...") ne' protocol-relative ("//host/...").
//
// Il backslash va trattato come un possibile "/" perche' per gli scheme
// "special" (http/https) lo standard WHATWG URL lo normalizza a "/": un
// valore come "/\evil.com" supererebbe un controllo che guarda solo "//" e
// "://", ma un browser lo risolve come "//evil.com" -> redirect esterno.
// Stesso discorso per le versioni percent-encoded (%5c, %2f) che un
// decodeURIComponent potrebbe smascherare in un secondo passaggio.
export function sanitizeCallbackUrl(raw: string | null | undefined): string {
  if (!raw) {
    return "/";
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return "/";
  }

  const candidates = [raw, decoded];

  for (const value of candidates) {
    if (
      !value.startsWith("/") ||
      value.startsWith("//") ||
      value.includes("://") ||
      value.includes("\\") ||
      value.includes("\t") ||
      value.includes("\n") ||
      value.includes("\r")
    ) {
      return "/";
    }
  }

  return raw;
}
