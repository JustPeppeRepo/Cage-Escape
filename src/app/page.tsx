import type { Metadata } from "next";
import { prisma } from "@/app/_lib/prisma";
import { env } from "@/app/_lib/env";
import { toRoomSummary } from "@/app/_lib/bookings/mappers";
import { HeroClient } from "@/components/horror/HeroClient";
import { JumpScare } from "@/components/horror/JumpScare";
import { RoomsGrid } from "@/components/horror/RoomsGrid";
import { ReviewPolaroid } from "@/components/horror/ReviewPolaroid";
import { FaqAccordion } from "@/components/horror/FaqAccordion";
import { SiteFooter } from "@/components/horror/SiteFooter";
import { SectionHeading } from "@/components/ui/SectionHeading";

export const metadata: Metadata = {
  title: "Cage Room — Escape Room Horror | Prenota il tuo incubo",
  description:
    "Prenota la tua escape room a tema horror. Enigmi, terrore e 90 minuti per sopravvivere. Prenotazione online sicura e immediata.",
};

const FAQ_ITEMS = [
  {
    question: "Quanto dura un'esperienza?",
    answer:
      "Ogni sessione dura circa 90 minuti, inclusi briefing iniziale e debriefing finale.",
  },
  {
    question: "È adatto ai minorenni?",
    answer:
      "Sì, con la presenza di un accompagnatore maggiorenne e la firma di un modulo di responsabilità.",
  },
  {
    question: "Cosa succede se non riesco a completare la stanza?",
    answer:
      "Nessun problema: un Game Master veglia sempre su di te e fornirà indizi se resterai bloccato troppo a lungo.",
  },
  {
    question: "Posso annullare o modificare la prenotazione?",
    answer:
      "Puoi gestire la tua prenotazione fino a 48 ore prima dell'orario scelto contattando il nostro staff.",
  },
];

const REVIEWS = [
  { author: "Marco T.", quote: "Non dormo più la notte. Consigliatissimo.", rotation: -4 },
  { author: "Giulia R.", quote: "Il livello di dettaglio è agghiacciante.", rotation: 3 },
  { author: "Luca P.", quote: "Ci siamo salvati per un pelo. Torneremo.", rotation: -2 },
];

export default async function Home() {
  const rooms = await prisma.room.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });
  const roomSummaries = rooms.map(toRoomSummary);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Cage Room",
    description:
      "Escape room a tema horror con esperienze immersive per gruppi.",
    url: env.NEXT_PUBLIC_APP_URL,
    priceRange: "€€",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <JumpScare />

      <main>
        <HeroClient />

        <section className="mx-auto max-w-6xl px-6 py-24">
          <SectionHeading eyebrow="Scegli il tuo destino" title="Le nostre stanze" />
          <RoomsGrid rooms={roomSummaries} />
        </section>

        <section className="bg-void-deep px-6 py-24">
          <SectionHeading eyebrow="Non fidarti di noi" title="Chi è sopravvissuto racconta" />
          <div className="mx-auto flex max-w-4xl flex-wrap justify-center gap-8">
            {REVIEWS.map((review) => (
              <ReviewPolaroid key={review.author} {...review} />
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-24">
          <SectionHeading eyebrow="Prima di prenotare" title="Domande frequenti" />
          <FaqAccordion items={FAQ_ITEMS} />
        </section>

        <SiteFooter />
      </main>
    </>
  );
}
