"use client";

import { authClient } from "@/lib/auth-client";

/**
 * Invalida la sessione Better Auth lato client e ricarica la pagina.
 * Necessario dopo logout/delete: un soft redirect da Server Action lascia
 * useSession (navbar) con i dati utente in cache.
 */
export async function clearClientSessionAndGoHome(href = "/") {
  try {
    await authClient.signOut();
  } catch {
    // Sessione già invalidata (es. dopo deleteUser server-side).
  }
  window.location.assign(href);
}
