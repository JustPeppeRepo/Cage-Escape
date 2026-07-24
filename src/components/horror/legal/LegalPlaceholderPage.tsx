import Link from "next/link";
import { LEGAL_ENTITY } from "@/app/_lib/site/legal";
import { SiteFooter } from "@/components/horror/SiteFooter";

type LegalPlaceholderPageProps = {
  title: string;
  description: string;
};

export function LegalPlaceholderPage({
  title,
  description,
}: LegalPlaceholderPageProps) {
  return (
    <main className="min-h-screen bg-void">
      <div className="mx-auto max-w-2xl px-6 py-20">
        <p className="text-xs uppercase tracking-[0.3em] text-ectoplasm/80">
          Informazioni legali
        </p>
        <h1 className="mt-3 font-heading text-4xl text-blood-bright">{title}</h1>
        <p className="mt-6 text-bone/70">{description}</p>
        <dl className="mt-10 space-y-2 text-sm text-bone/55">
          <div>
            <dt className="inline text-bone/80">Titolare: </dt>
            <dd className="inline">{LEGAL_ENTITY.legalName}</dd>
          </div>
          <div>
            <dt className="inline text-bone/80">Forma giuridica: </dt>
            <dd className="inline">{LEGAL_ENTITY.legalForm}</dd>
          </div>
          <div>
            <dt className="inline text-bone/80">Partita IVA: </dt>
            <dd className="inline">{LEGAL_ENTITY.vatNumber}</dd>
          </div>
        </dl>
        <p className="mt-8 text-sm text-bone/45">
          Il testo completo sarà pubblicato tramite iubenda non appena l&apos;account
          sarà configurato. Nel frattempo puoi{" "}
          <Link href="/contatti" className="text-bone/70 underline hover:text-bone">
            contattarci
          </Link>
          .
        </p>
      </div>
      <SiteFooter />
    </main>
  );
}
