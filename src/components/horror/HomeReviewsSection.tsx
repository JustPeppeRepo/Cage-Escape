import { getPublishedReviews } from "@/app/_lib/site/content";
import { ReviewPolaroid } from "@/components/horror/ReviewPolaroid";
import { SectionHeading } from "@/components/ui/SectionHeading";

export async function HomeReviewsSection() {
  const reviews = await getPublishedReviews();

  if (reviews.length === 0) {
    return null;
  }

  return (
    <section className="bg-void-deep px-4 py-16 sm:px-6 sm:py-24">
      <SectionHeading eyebrow="Non fidarti di noi" title="Chi è sopravvissuto racconta" />
      <div className="mx-auto flex max-w-4xl flex-wrap justify-center gap-8">
        {reviews.map((review) => (
          <ReviewPolaroid
            key={review.id}
            author={review.author}
            quote={review.quote}
            rotation={review.rotation}
          />
        ))}
      </div>
    </section>
  );
}
