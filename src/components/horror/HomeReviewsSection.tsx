import { getPublishedReviews } from "@/app/_lib/site/content";
import { ReviewCard } from "@/components/horror/ReviewCard";
import { SectionHeading } from "@/components/ui/SectionHeading";

const IMAGE_POSITIONS = ["center", "left center", "right center"] as const;

export async function HomeReviewsSection() {
  const reviews = await getPublishedReviews();

  if (reviews.length === 0) {
    return null;
  }

  const cards = (keyPrefix: string) =>
    reviews.map((review, index) => (
      <ReviewCard
        key={`${keyPrefix}-${review.id}`}
        author={review.author}
        quote={review.quote}
        imagePosition={IMAGE_POSITIONS[index % IMAGE_POSITIONS.length]}
      />
    ));

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
          <div className="flex gap-5 pr-5 sm:gap-6 sm:pr-6">{cards("a")}</div>
          <div aria-hidden="true" className="flex gap-5 pr-5 sm:gap-6 sm:pr-6">
            {cards("b")}
          </div>
        </div>
      </div>
    </section>
  );
}
