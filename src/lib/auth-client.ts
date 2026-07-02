import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "@/lib/auth";

// Nessun baseURL esplicito: l'app e same-origin (le route Better Auth vivono
// sotto /api/auth nello stesso dominio), quindi il client risolve
// automaticamente l'origin corrente. Evita di importare env.ts (che valida
// anche variabili solo server-side) dentro un modulo destinato al bundle client.
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
});
