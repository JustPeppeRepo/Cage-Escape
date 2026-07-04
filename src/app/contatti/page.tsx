import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/horror/contact/ContactForm";
import { SocialLinks } from "@/components/horror/contact/SocialLinks";

export const metadata: Metadata = {
  title: "Contatti | Cage Room",
  description:
    "Contattaci per prenotazioni, informazioni o per segnalare qualcosa di strano uscito dalla stanza.",
  alternates: { canonical: "/contatti" },
};

export default function ContattiPage() {
  return (
    <main className="min-h-screen bg-void px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-2">
        <div>
          <Link href="/" className="text-sm text-bone/50 hover:text-bone">
            ← Torna alla home
          </Link>
          <h1 className="mt-6 font-[family-name:var(--font-display)] text-4xl text-blood-bright">
            Contatti
          </h1>
          <p className="mt-4 text-bone/70">
            Scrivici per qualsiasi dubbio. Il recupero dei corpi non è incluso
            nel prezzo della prenotazione, ma possiamo indicarti un servizio
            fidato.
          </p>

          <div className="mt-10 space-y-4 text-sm text-bone/60">
            <p>
              <span className="text-bone/80">Indirizzo:</span> Via del Manicomio
              13, 00100 Roma
            </p>
            <p>
              <span className="text-bone/80">Orari segreteria:</span> Lun–Dom
              10:00–22:00
            </p>
          </div>

          <SocialLinks />

          <div
            className="mt-10 flex h-48 items-center justify-center rounded border border-dashed border-void-mist bg-void-deep text-sm text-bone/40"
            aria-hidden
          >
            Mappa stilizzata — il buio conosce la strada
          </div>
        </div>

        <div className="rounded-md border border-void-mist bg-void-deep p-6">
          <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl text-bone">
            Form spettrale
          </h2>
          <ContactForm />
        </div>
      </div>
    </main>
  );
}
