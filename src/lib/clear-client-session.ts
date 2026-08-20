"use client";

import { createClient } from "@/utils/supabase/client";

/**
 * Invalida la sessione Supabase lato client e ricarica la pagina.
 * Necessario dopo logout/delete: un soft redirect da Server Action lascia
 * la navbar con i dati utente in cache.
 */
export async function clearClientSessionAndGoHome(href = "/") {
  try {
    const supabase = createClient();
    await supabase.auth.signOut();
  } catch {
    // Sessione già invalidata (es. dopo deleteUser server-side).
  }
  window.location.assign(href);
}
