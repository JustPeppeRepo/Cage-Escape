import type { Metadata } from "next";
import dynamic from "next/dynamic";
import Link from "next/link";

const AboutSection = dynamic(
  () =>
    import("@/components/horror/about/AboutSection").then(
      (mod) => mod.AboutSection,
    ),
  {
    loading: () => (
      <div className="h-40 max-w-xl animate-pulse rounded bg-void-mist/30" />
    ),
  },
);

const FounderSection = dynamic(
  () =>
    import("@/components/horror/about/FounderSection").then(
      (mod) => mod.FounderSection,
    ),
  {
    loading: () => (
      <div className="h-64 max-w-3xl animate-pulse rounded bg-void-mist/30" />
    ),
  },
);

const TeamSection = dynamic(
  () =>
    import("@/components/horror/about/TeamSection").then(
      (mod) => mod.TeamSection,
    ),
  {
    loading: () => (
      <div className="ml-auto h-24 max-w-md animate-pulse rounded bg-void-mist/30" />
    ),
  },
);

const ChalkArrowConnector = dynamic(
  () =>
    import("@/components/horror/about/ChalkArrowConnector").then(
      (mod) => mod.ChalkArrowConnector,
    ),
  {
    loading: () => <div className="mx-auto h-36 w-full max-w-2xl sm:h-52" />,
  },
);

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Chi siamo | Cage Room",
  description:
    "Missione, visione e fondatore di CAGE: escape room immersive dove le avventure non si osservano — si attraversano.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-void px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-4xl">
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

        <div className="flex flex-col gap-6 sm:gap-8">
          <div className="relative mr-auto max-w-xl lg:pb-40">
            <AboutSection
              title="Missione"
              index={0}
              align="left"
              className="max-w-none"
            >
              <p>
                CAGE nasce dal desiderio di trasformare le avventure che esistono
                nei film in esperienze che possano essere vissute in prima
                persona.
              </p>
              <p>
                Non vogliamo che i giocatori osservino una storia, vogliamo che
                la attraversino: esplorando, scoprendo, agendo, superando
                ostacoli e vivendo emozioni reali in condizioni di sicurezza.
              </p>
              <p>
                Per noi un&apos;avventura non è una sequenza di enigmi: è un
                viaggio fatto di scelte, fatica, tensione, scoperta e conquista.
              </p>
              <p>
                CAGE esiste per permettere alle persone di vivere ciò che
                normalmente possono soltanto immaginare e trasformare queste
                esperienze in ricordi difficili da dimenticare.
              </p>
            </AboutSection>

            {/* Mobile / tablet: in-flow connector */}
            <div className="lg:hidden">
              <ChalkArrowConnector variant="longLtr" />
            </div>

            {/* Large screens: origin = mid-right of Missione */}
            <div className="pointer-events-none absolute left-[68%] top-[42%] z-10 hidden w-52 overflow-visible lg:block xl:left-[70%] xl:w-60">
              <ChalkArrowConnector
                variant="longLtr"
                className="!m-0 h-[24rem] w-full max-w-none xl:h-[28rem]"
              />
            </div>
          </div>

          <AboutSection title="Visione" index={1} align="right">
            <p>
              CAGE vuole diventare il luogo in cui sia possibile vivere avventure
              sempre più vicine a quelle che oggi esistono solo
              nell&apos;immaginazione.
            </p>
            <p>
              Dall&apos;esplorazione di una piramide perduta alla sopravvivenza in
              un bunker, fino a esperienze fisiche, immersive e sicure che
              ridefiniscano il concetto stesso di Escape room.
            </p>
            <p>
              L&apos;obiettivo finale non è costruire stanze. L&apos;obiettivo
              finale è costruire avventure.
            </p>
          </AboutSection>

          <ChalkArrowConnector variant="shortRtl" />

          <FounderSection index={2} />

          <ChalkArrowConnector variant="tallDown" />

          <TeamSection index={3} />
        </div>

        <div className="mt-20 text-center sm:mt-24">
          <Link
            href="/rooms"
            className="inline-block rounded bg-blood px-8 py-3 text-bone transition-colors hover:bg-blood-bright hover:animate-glitch-hover"
          >
            Scegli la tua stanza
          </Link>
        </div>
      </div>
    </main>
  );
}
