import type { Metadata } from "next";
import { Suspense } from "react";
import { env } from "@/app/_lib/env";
import { Hero } from "@/components/horror/Hero";
import { HomeRoomsSection } from "@/components/horror/HomeRoomsSection";
import { HomeReviewsSection } from "@/components/horror/HomeReviewsSection";
import {
  ReviewsSectionSkeleton,
  RoomsSectionSkeleton,
} from "@/components/horror/HomeSkeletons";
import { FaqAccordion } from "@/components/horror/FaqAccordion";
import { HomeBookingCta } from "@/components/horror/HomeBookingCta";
import { SiteFooter } from "@/components/horror/SiteFooter";
import { SectionHeading } from "@/components/ui/SectionHeading";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: {
    absolute: "Cage Escape Room — Escape Room Horror | Prenota il tuo incubo",
  },
  description:
    "Prenota da Cage Escape Room la tua escape room horror. Enigmi, terrore e 90 minuti per sopravvivere. Prenotazione online sicura e immediata.",
  openGraph: {
    title: "Cage Escape Room — Escape Room Horror | Prenota il tuo incubo",
    description:
      "Prenota da Cage Escape Room la tua escape room horror. Enigmi, terrore e 90 minuti per sopravvivere.",
  },
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

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Cage Escape Room",
    description:
      "Escape room a tema horror con esperienze immersive per gruppi.",
    url: env.NEXT_PUBLIC_APP_URL,
    priceRange: "€€",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          // Escape < per evitare break-out da </script> se un campo dinamico
          // venisse mai avvelenato (es. URL di origine).
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <main>
        <Hero />

        <Suspense fallback={<RoomsSectionSkeleton />}>
          <HomeRoomsSection />
        </Suspense>

        <Suspense fallback={<ReviewsSectionSkeleton />}>
          <HomeReviewsSection />
        </Suspense>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <SectionHeading eyebrow="Prima di prenotare" title="Domande frequenti" />
          <FaqAccordion items={FAQ_ITEMS} />
        </section>

        <HomeBookingCta />

        <SiteFooter />
      </main>
    </>
  );
}
