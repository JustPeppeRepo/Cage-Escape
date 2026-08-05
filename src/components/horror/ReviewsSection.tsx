import Image from "next/image";
import { getReviewCoverUrl } from "@/app/_lib/media/urls";
import { getPublishedReviews } from "@/app/_lib/site/content";
import { SectionHeading } from "@/components/ui/SectionHeading";

const IMAGE_POSITIONS = ["center", "left center", "right center"] as const;

/** Card (~320px) + gap: enough copies so one strip ≥ ~ultrawide viewport. */
const CARD_STRIDE_PX = 344;
const MIN_STRIP_WIDTH_PX = 2560;

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

function ReviewCard({
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
            alt={`Foto della recensione di ${author}`}
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

export async function ReviewsSection() {
  const reviews = await getPublishedReviews();

  if (reviews.length === 0) {
    return null;
  }

  const repeats = Math.max(
    1,
    Math.ceil(MIN_STRIP_WIDTH_PX / (reviews.length * CARD_STRIDE_PX)),
  );

  const cards = (keyPrefix: string) =>
    Array.from({ length: repeats }, (_, copyIndex) =>
      reviews.map((review, index) => (
        <ReviewCard
          key={`${keyPrefix}-${copyIndex}-${review.id}`}
          author={review.author}
          quote={review.quote}
          imageUrl={getReviewCoverUrl(review)}
          imagePosition={IMAGE_POSITIONS[index % IMAGE_POSITIONS.length]}
        />
      )),
    );

  return (
    <section className="overflow-hidden bg-void-deep py-16 sm:py-24">
      <div className="px-4 sm:px-6">
        <SectionHeading
          eyebrow="Non fidarti di noi"
          title="Chi è sopravvissuto racconta"
        />
      </div>

      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-linear-to-r from-void-deep to-transparent sm:w-16"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-linear-to-l from-void-deep to-transparent sm:w-16"
        />

        <div className="reviews-marquee-track flex w-max py-2 hover:[animation-play-state:paused]">
          <div className="reviews-marquee-group flex gap-5 pr-5 sm:gap-6 sm:pr-6">
            {cards("a")}
          </div>
          <div
            aria-hidden="true"
            className="reviews-marquee-group flex gap-5 pr-5 sm:gap-6 sm:pr-6"
          >
            {cards("b")}
          </div>
        </div>
      </div>
    </section>
  );
}
