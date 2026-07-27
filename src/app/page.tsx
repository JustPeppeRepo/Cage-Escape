import type { Metadata } from "next";
import { Suspense } from "react";
import { env } from "@/app/_lib/env";
import { MAINTENANCE } from "@/app/_lib/site/maintenance";
import { HeroSection } from "@/components/horror/HeroSection";
import { RoomsSection } from "@/components/horror/RoomsSection";
import { ReviewsSection } from "@/components/horror/ReviewsSection";
import {
  ReviewsSectionSkeleton,
  RoomsSectionSkeleton,
} from "@/components/horror/HomeSkeletons";
import { FaqSection } from "@/components/horror/FaqSection";
import { BookingCtaSection } from "@/components/horror/BookingCtaSection";
import { MaintenanceScreen } from "@/components/horror/MaintenanceScreen";
import { SiteFooter } from "@/components/horror/SiteFooter";

export const revalidate = 3600;

export const metadata: Metadata = MAINTENANCE.enabled
  ? {
      title: {
        absolute: `${MAINTENANCE.brand} — ${MAINTENANCE.headline}`,
      },
      description: MAINTENANCE.message,
      robots: { index: false, follow: false },
    }
  : {
      title: {
        absolute: "Cage Escape Room — Escape Room Immersive | Prenota online",
      },
      description:
        "Prenota da Cage Escape Room la tua escape room immersiva. Temi diversi, dall'avventura all'horror: enigmi e 90 minuti fuori dal mondo. Prenotazione online sicura.",
      openGraph: {
        title: "Cage Escape Room — Escape Room Immersive | Prenota online",
        description:
          "Prenota da Cage Escape Room la tua escape room immersiva. Temi diversi, dall'avventura all'horror: enigmi e 90 minuti fuori dal mondo.",
      },
    };

export default function Home() {
  // Difesa in profondita': unita al rewrite in proxy.ts.
  if (MAINTENANCE.enabled) {
    return <MaintenanceScreen />;
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Cage Escape Room",
    description:
      "Escape room immersive con esperienze a tema per gruppi, incluse stanze horror.",
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
        <HeroSection />

        <Suspense fallback={<RoomsSectionSkeleton />}>
          <RoomsSection />
        </Suspense>

        <Suspense fallback={<ReviewsSectionSkeleton />}>
          <ReviewsSection />
        </Suspense>

        <FaqSection />

        <BookingCtaSection />

        <SiteFooter />
      </main>
    </>
  );
}
