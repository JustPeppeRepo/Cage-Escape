/**
 * Chi siamo `/about`
 *
 * @description Missione, visione, fondatore e team.
 * @components AboutContent (dynamic), Link CTA stanze
 * @seo metadata + openGraph / twitter
 */
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import Link from "next/link";

const AboutContent = dynamic(
  () =>
    import("@/components/horror/about/AboutContent").then(
      (mod) => mod.AboutContent,
    ),
  {
    loading: () => (
      <div className="relative flex flex-col gap-16 sm:gap-24">
        <div className="h-40 max-w-xl animate-pulse rounded bg-void-mist/30" />
        <div className="ml-auto h-40 max-w-xl animate-pulse rounded bg-void-mist/30" />
        <div className="h-64 max-w-3xl animate-pulse rounded bg-void-mist/30" />
        <div className="ml-auto h-24 max-w-md animate-pulse rounded bg-void-mist/30" />
      </div>
    ),
  },
);

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Chi siamo",
  description:
    "Chi è Cage Escape Room: missione, visione e fondatore. Escape room immersive dove le avventure non si osservano — si attraversano.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "Chi siamo | Cage Escape Room",
    description:
      "Missione, visione e fondatore di Cage Escape Room: escape room immersive a tema.",
    url: "/about",
  },
  twitter: {
    card: "summary_large_image",
    title: "Chi siamo | Cage Escape Room",
    description:
      "Missione, visione e fondatore di Cage Escape Room: escape room immersive a tema.",
  },
};

export default function AboutPage() {
  return (
    <main
      id="main-content"
      className="min-h-screen bg-void px-4 py-16 sm:px-6 sm:py-24"
    >
      <div className="mx-auto max-w-4xl lg:max-w-5xl">
        <header className="mb-16 flex flex-col items-center gap-2 text-center sm:mb-20">
          <span className="text-xs uppercase tracking-[0.3em] text-ectoplasm/80">
            Scopri l&apos;esperienza CAGE
          </span>
          <h1 className="relative inline-block font-heading text-4xl text-blood-bright sm:text-5xl">
            Chi siamo
            <span
              aria-hidden="true"
              className="absolute -bottom-2 left-1/2 h-[2px] w-24 -translate-x-1/2 bg-blood"
            />
          </h1>
        </header>

        <AboutContent />

        <div className="hero-cta mt-20 text-center sm:mt-24">
          <Link
            href="/rooms"
            className="hero-cta-pulse inline-block rounded-sm border-2 border-blood-bright bg-blood px-8 py-4 font-heading text-lg tracking-widest text-bone transition-colors hover:bg-blood-bright sm:px-12 sm:py-5 sm:text-xl"
          >
            <span className="hero-cta-label inline-block">
              Scegli la tua stanza
            </span>
          </Link>
        </div>
      </div>
    </main>
  );
}
