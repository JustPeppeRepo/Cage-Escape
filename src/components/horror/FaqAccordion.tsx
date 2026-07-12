type FaqItem = {
  question: string;
  answer: string;
};

type FaqAccordionProps = {
  items: FaqItem[];
};

export function FaqAccordion({ items }: FaqAccordionProps) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
      {items.map((item) => (
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
  );
}
