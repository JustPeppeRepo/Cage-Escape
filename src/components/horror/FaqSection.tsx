import { SectionHeading } from "@/components/ui/SectionHeading";

export const FAQ_ITEMS = [
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
] as const;

export function FaqSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <SectionHeading eyebrow="Prima di prenotare" title="Domande frequenti" />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
        {FAQ_ITEMS.map((item) => (
          <details
            key={item.question}
            className="group overflow-hidden rounded-sm border border-void-mist bg-void-deep"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left text-bone transition-colors marker:content-none hover:bg-void-mist/40 [&::-webkit-details-marker]:hidden">
              <span className="font-medium">{item.question}</span>
              <span
                aria-hidden="true"
                className="text-blood-bright transition-transform duration-200 group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="border-t border-blood/40 px-5 py-4 text-sm text-bone/70">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
