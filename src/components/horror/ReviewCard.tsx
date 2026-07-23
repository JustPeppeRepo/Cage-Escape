import Image from "next/image";

type ReviewCardProps = {
  author: string;
  quote: string;
  imageUrl?: string | null;
  imagePosition?: string;
};

function StarRating() {
  return (
    <div
      role="img"
      aria-label="Valutazione: 5 su 5 stelle"
      className="flex items-center gap-0.5 text-blood-bright"
    >
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} aria-hidden="true" className="text-sm leading-none">
          ★
        </span>
      ))}
    </div>
  );
}

export function ReviewCard({
  author,
  quote,
  imageUrl,
  imagePosition = "center",
}: ReviewCardProps) {
  return (
    <article className="flex h-full w-72 shrink-0 flex-col overflow-hidden rounded-md border border-void-mist bg-void shadow-[0_0_20px_rgba(0,0,0,0.6)] sm:w-80">
      <div className="relative aspect-16/10 w-full overflow-hidden bg-void-deep">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            fill
            unoptimized
            className="object-cover opacity-80"
            style={{ objectPosition: imagePosition }}
            sizes="320px"
          />
        ) : (
          <div
            aria-hidden
            className="absolute inset-0 bg-linear-to-br from-void via-void-deep to-blood/30"
          />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-t from-void via-void/40 to-blood/20"
        />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <StarRating />
        <blockquote className="flex-1 text-sm leading-relaxed text-bone/85">
          &ldquo;{quote}&rdquo;
        </blockquote>
        <footer className="border-t border-void-mist pt-3 text-xs font-semibold uppercase tracking-[0.18em] text-blood-bright">
          {author}
        </footer>
      </div>
    </article>
  );
}
