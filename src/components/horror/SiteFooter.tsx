import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-void-mist px-6 py-12 text-center text-sm text-bone/50">
      <p>© {new Date().getFullYear()} Cage Room. Chi entra, spera di uscire.</p>
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
        <summary className="cursor-pointer text-bone/40 hover:text-bone/60">
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
