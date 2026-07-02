type ReviewPolaroidProps = {
  author: string;
  quote: string;
  rotation: number;
};

export function ReviewPolaroid({ author, quote, rotation }: ReviewPolaroidProps) {
  return (
    <figure
      style={{ transform: `rotate(${rotation}deg)` }}
      className="flex w-56 flex-col gap-4 bg-bone p-4 pb-6 text-void-deep shadow-[0_8px_20px_rgba(0,0,0,0.5)]"
    >
      <div className="flex h-40 items-center justify-center border border-void-mist/30 bg-void-deep/90 text-blood-bright">
        <span aria-hidden="true" className="text-4xl">
          🩸
        </span>
      </div>
      <blockquote className="font-[family-name:var(--font-display)] text-sm leading-snug">
        &ldquo;{quote}&rdquo;
      </blockquote>
      <figcaption className="text-right text-xs uppercase tracking-wide text-void-deep/70">
        — {author}
      </figcaption>
    </figure>
  );
}
