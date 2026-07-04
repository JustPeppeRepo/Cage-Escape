// Helpers condivisi dai moduli che inviano email via Resend (auth, contact,
// stripe ops-alert). Centralizzati qui per evitare che il fix del from-address
// o della rilevazione dell'errore "sandbox domain" debba essere ripetuto in
// ogni singolo modulo.

/**
 * Il dominio di test "onboarding@resend.dev" fornito di default da Resend può
 * consegnare email SOLO all'indirizzo del proprietario dell'account Resend:
 * qualsiasi invio verso un destinatario diverso (es. l'email di un cliente
 * reale che richiede il reset password) viene rifiutato con un 403.
 * Impostando RESEND_FROM_EMAIL con un indirizzo del dominio verificato su
 * Resend, questo limite sparisce per tutti i moduli che usano questo helper.
 */
export function getResendFromAddress(
  displayName: string,
  fromEmail: string | undefined,
): string {
  const address =
    fromEmail && fromEmail.length > 0 ? fromEmail : "onboarding@resend.dev";
  return `${displayName} <${address}>`;
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
