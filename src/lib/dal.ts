import { cache } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { logError } from "@/lib/logger";

// Data Access Layer: unico punto in cui viene letta/validata la sessione
// server-side (query al DB tramite Better Auth, non il semplice cookie
// ottimistico letto dal proxy). `cache()` deduplica la chiamata entro lo
// stesso render pass, cosi' piu' componenti/azioni che la richiamano nella
// stessa request non pagano round-trip multipli.
export const getCurrentSession = cache(async () => {
  try {
    return await auth.api.getSession({ headers: await headers() });
  } catch (error) {
    logError("getCurrentSession", "Session lookup failed", error);
    return null;
  }
});

// Da usare in ogni page/azione che richiede un utente autenticato.
// Ridondante rispetto al controllo ottimistico nel proxy, ma e' l'unico che
// conta davvero: il proxy puo' essere bypassato da refactor futuri del
// matcher, questa funzione no.
export async function requireUser() {
  const session = await getCurrentSession();

  if (!session?.user) {
    redirect("/login");
  }

  return session;
}

// Da chiamare in OGNI singola page.tsx sotto /admin (non solo nel layout):
// per via del partial rendering di Next.js i layout non vengono ri-eseguiti
// ad ogni navigazione client-side tra pagine sorelle, quindi un controllo
// fatto solo a livello di layout puo' non essere ri-verificato quando si
// naviga da una pagina admin all'altra.
export async function requireAdmin() {
  const session = await requireUser();

  if (session.user.role !== "ADMIN") {
    notFound();
  }

  return session;
}
