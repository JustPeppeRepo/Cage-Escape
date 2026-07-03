// Impedisce un open redirect tramite il parametro callbackUrl: accetta solo
// path relativi interni allo stesso host ("/qualcosa"), mai URL assoluti
// ("scheme://...") ne' protocol-relative ("//host/...").
export function sanitizeCallbackUrl(raw: string | null | undefined): string {
  if (!raw) {
    return "/";
  }

  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) {
    return "/";
  }

  return raw;
}
