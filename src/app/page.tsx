/**
 * Homepage `/`
 *
 * @description Hero, stanze, recensioni, FAQ, CTA booking e JSON-LD SEO.
 * @components HeroSection, RoomsSection, ReviewsSection, FaqSection,
 *   BookingCtaSection, SiteFooter, MaintenanceScreen, JsonLd, HomeSkeletons
 * @data getActiveRooms / getPublishedReviews (via sezioni + Suspense)
 * @seo metadata, FAQPage + LocalBusiness + Person JSON-LD
 */
import type { Metadata } from "next";
import { Suspense } from "react";
import { MAINTENANCE } from "@/app/_lib/site/maintenance";
import {
  getSameAsLinks,
  getSiteUrl,
  SITE_CONTACT,
  SITE_NAME,
} from "@/app/_lib/site/seo";
import { HeroSection } from "@/components/horror/HeroSection";
import { RoomsSection } from "@/components/horror/RoomsSection";
import { ReviewsSection } from "@/components/horror/ReviewsSection";
import {
  ReviewsSectionSkeleton,
  RoomsSectionSkeleton,
} from "@/components/horror/HomeSkeletons";
import { FaqSection, FAQ_ITEMS } from "@/components/horror/FaqSection";
import { BookingCtaSection } from "@/components/horror/BookingCtaSection";
import { MaintenanceScreen } from "@/components/horror/MaintenanceScreen";
import { SiteFooter } from "@/components/horror/SiteFooter";
import { JsonLd } from "@/components/seo/JsonLd";

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
      alternates: { canonical: "/" },
      openGraph: {
        title: "Cage Escape Room — Escape Room Immersive | Prenota online",
        description:
          "Prenota da Cage Escape Room la tua escape room immersiva. Temi diversi, dall'avventura all'horror: enigmi e 90 minuti fuori dal mondo.",
        url: "/",
      },
    };

export default function Home() {
  // Difesa in profondita': unita al rewrite in proxy.ts.
  if (MAINTENANCE.enabled) {
    return <MaintenanceScreen />;
  }

  const siteUrl = getSiteUrl();
  const sameAs = getSameAsLinks();

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LocalBusiness",
        "@id": `${siteUrl}/#business`,
        name: SITE_NAME,
        description:
          "Escape room immersive con esperienze a tema per gruppi, incluse stanze horror.",
        url: siteUrl,
        image: `${siteUrl}/opengraph-image.jpg`,
        priceRange: "€€",
        telephone: SITE_CONTACT.telephone,
        email: SITE_CONTACT.email,
        address: {
          "@type": "PostalAddress",
          addressLocality: SITE_CONTACT.addressLocality,
          addressCountry: SITE_CONTACT.addressCountry,
        },
        sameAs,
        founder: { "@id": `${siteUrl}/#founder` },
      },
      {
        "@type": "Person",
        "@id": `${siteUrl}/#founder`,
        name: "Girolamo Emanuele Aiello",
        jobTitle: "Fondatore",
        url: getSiteUrl("/about"),
        worksFor: { "@id": `${siteUrl}/#business` },
        sameAs,
      },
      {
        "@type": "Person",
        "@id": `${siteUrl}/#developer`,
        name: "Giuseppe Aiello",
        jobTitle: "Web Developer",
        url: getSiteUrl("/about"),
        worksFor: { "@id": `${siteUrl}/#business` },
        sameAs,
      },
      {
        "@type": "FAQPage",
        "@id": `${siteUrl}/#faq`,
        mainEntity: FAQ_ITEMS.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />

      <main id="main-content">
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
