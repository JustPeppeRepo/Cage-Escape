import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { SocialLinks } from "@/components/horror/contact/SocialLinks";

const ContactForm = dynamic(
  () =>
    import("@/components/horror/contact/ContactForm").then(
      (mod) => mod.ContactForm,
    ),
  {
    loading: () => (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-10 animate-pulse rounded bg-void-mist/40" />
        ))}
        <div className="h-10 w-32 animate-pulse rounded bg-void-mist/40" />
      </div>
    ),
  },
);

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Contatti",
  description:
    "Contatta Cage Escape Room per prenotazioni e informazioni. Scrivici o vieni a trovarci.",
  alternates: { canonical: "/contatti" },
  openGraph: {
    title: "Contatti | Cage Escape Room",
    description:
      "Contatta Cage Escape Room per prenotazioni, orari e informazioni sulle escape room.",
  },
};

export default function ContattiPage() {
  return (
    <main className="min-h-screen bg-void px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-2">
        <div>
          <span className="text-xs uppercase tracking-[0.3em] text-ectoplasm/80">
            Scopri come trovarci
          </span>
          <h1 className="mt-2 font-heading text-4xl text-blood-bright">
            Contatti
          </h1>
          <p className="mt-4 text-bone/70">
            Scrivici per qualsiasi dubbio. Il recupero dei corpi non è incluso
            nel prezzo della prenotazione, ma possiamo indicarti un servizio
            fidato.
          </p>

          <div className="mt-10 space-y-4 text-sm text-bone/60">
            <p>
              <span className="text-bone/80">Indirizzo:</span> Via sconosciuta, Palermo
            </p>
            <p>
              <span className="text-bone/80">WhatsApp:</span>{" "}
              <a
                href="https://wa.me/393929375672"
                className="text-bone/70 underline-offset-2 hover:text-bone hover:underline"
              >
                392 937 5672
              </a>
            </p>
            <p>
              <span className="text-bone/80">Email:</span>{" "}
              <a
                href="mailto:info@cageroom.it"
                className="text-bone/70 underline-offset-2 hover:text-bone hover:underline"
              >
                info@cageroom.it
              </a>
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
          <h2 className="mb-4 font-heading text-xl text-blood-bright">
            Scrivici una mail
          </h2>
          <ContactForm />
        </div>
      </div>
    </main>
  );
}
