import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { logError } from "@/lib/logger";

// ⚠️ CRITICAL SECURITY CHECK [IDOR_PREVENTION]: [User session matching before booking creation]
// Data Access Layer: único punto de acceso para validación de sesión server-side
// `cache()` deduplica las llamadas dentro del mismo render pass, evitando
// múltiples round-trips de componentes/acciones que requieren la sesión.
export const getCurrentSession = cache(async () => {
  try {
    const supabase = await createClient();
    
    // ⚠️ CRITICAL SECURITY CHECK [IDOR_PREVENTION]: Enforce getUser() validation
    // getUser() performs server-side JWT validation against Supabase Auth service
    // This prevents attacks using tampered or forged client-side JWT tokens
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return null;
    }
    
    // Fetch user profile from database to get role and other details
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (!profile) {
      return null;
    }
    
    return {
      user: {
        id: user.id,
        email: user.email!,
        role: profile.role,
        name: profile.name,
        username: profile.username,
        phone: profile.phone,
        image: profile.image,
        emailVerified: profile.emailVerified,
      }
    };
  } catch (error) {
    logError("getCurrentSession", "Session lookup failed", {
      message: error instanceof Error ? error.message : String(error),
    });
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
