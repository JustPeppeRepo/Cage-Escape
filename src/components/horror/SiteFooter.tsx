import Link from "next/link";
import {
  getIubendaConfig,
  getLegalLinks,
  LEGAL_ENTITY,
} from "@/app/_lib/site/legal";

const COPYRIGHT_YEAR = 2026;

export function SiteFooter() {
  const legalLinks = getLegalLinks();
  const { isConfigured: iubendaReady } = getIubendaConfig();

  return (
    <footer className="border-t border-void-mist bg-void-deep px-6 py-12 text-center text-sm text-bone/50">
      <address className="mx-auto max-w-lg not-italic text-xs leading-relaxed text-bone/40">
        <p>
          © {COPYRIGHT_YEAR} {LEGAL_ENTITY.legalName}
        </p>
        <p>
          {LEGAL_ENTITY.legalForm} · P. IVA {LEGAL_ENTITY.vatNumber}
        </p>
      </address>

      <nav
        className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs"
        aria-label="Informazioni legali"
      >
        {legalLinks.map((link) =>
          link.iubendaEmbed ? (
            <a
              key={link.id}
              href={link.href}
              className="iubenda-nostyle no-brand iubenda-noiframe iubenda-embed hover:text-bone/80"
              title={link.label}
            >
              {link.label}
            </a>
          ) : (
            <Link
              key={link.id}
              href={link.href}
              className="hover:text-bone/80"
            >
              {link.label}
            </Link>
          ),
        )}
        {iubendaReady ? (
          <a
            href="#"
            className="iubenda-cs-preferences-link hover:text-bone/80"
          >
            Preferenze cookie
          </a>
        ) : null}
      </nav>

      <nav className="mt-4 flex flex-wrap justify-center gap-4 text-xs">
        <Link href="/about" className="hover:text-bone/80">
          Chi siamo
        </Link>
        <Link href="/contatti" className="hover:text-bone/80">
          Contatti
        </Link>
        <Link href="/rooms" className="hover:text-bone/80">
          Stanze
        </Link>
      </nav>

      <details className="mx-auto mt-6 max-w-md text-left">
        <summary className="cursor-pointer text-center text-[10px] text-bone/40 hover:text-bone/60">
          Dettagli che preferiremmo non mostrare
        </summary>
        <p className="mt-2 text-xs leading-relaxed text-bone/40">
          Se senti sussurri nel corridoio, non è il condizionatore. Se trovi una
          porta che non c&apos;era prima, non aprirla. Se conosci il simbolo{" "}
          <Link href="/maledizione" className="text-blood/60 hover:text-blood">
            nascosto nel buio
          </Link>
          , forse il rito ti ricompenserà.
        </p>
      </details>
    </footer>
  );
}
