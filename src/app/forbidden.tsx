import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-void px-6 text-center text-bone">
      <h1 className="font-[family-name:var(--font-display)] text-4xl text-blood-bright">
        403 — Accesso negato
      </h1>
      <p className="text-bone/70">
        Non hai i permessi necessari per accedere a questa risorsa.
      </p>
      <Link href="/" className="underline decoration-blood underline-offset-4">
        Torna alla home
      </Link>
    </main>
  );
}
