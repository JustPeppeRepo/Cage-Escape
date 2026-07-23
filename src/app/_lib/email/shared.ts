// Helpers condivisi dai moduli che inviano email via Resend (auth, contact,
// stripe ops-alert). Centralizzati qui per evitare che il fix del from-address
// o della rilevazione dell'errore "sandbox domain" debba essere ripetuto in
// ogni singolo modulo.

/**
 * Il from-address deve essere su un dominio verificato in Resend
 * (RESEND_FROM_EMAIL). Senza, non si può consegnare agli utenti reali:
 * il dominio di test onboarding@resend.dev consegna solo all'owner
 * dell'account Resend.
 */
export function getResendFromAddress(
  displayName: string,
  fromEmail: string | undefined,
): string {
  if (!fromEmail || fromEmail.length === 0) {
    throw new Error(
      "RESEND_FROM_EMAIL mancante: imposta un indirizzo su dominio verificato Resend",
    );
  }
  return `${displayName} <${fromEmail}>`;
}

/**
 * Rileva l'errore Resend "You can only send testing emails to your own email
 * address..." dovuto all'uso del dominio di test senza un dominio verificato.
 * Usato per loggare un messaggio azionabile invece del solo errore grezzo.
 */
export function isSandboxDomainRestrictionError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("own email address") ||
    normalized.includes("verify a domain")
  );
}
