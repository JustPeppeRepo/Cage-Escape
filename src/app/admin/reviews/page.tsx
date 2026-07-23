import type { Metadata } from "next";
import { prisma } from "@/app/_lib/prisma";
import { getReviewCoverUrl } from "@/app/_lib/media/urls";
import { requireAdmin } from "@/lib/dal";
import { ReviewsManager } from "@/components/admin/ReviewsManager";

export const metadata: Metadata = {
  title: "Recensioni | Admin | Cage Room",
  robots: { index: false, follow: false },
};

export default async function AdminReviewsPage() {
  await requireAdmin();

  const reviews = await prisma.review.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      author: true,
      quote: true,
      rotation: true,
      sortOrder: true,
      isPublished: true,
      imageUpdatedAt: true,
    },
  });

  return (
    <main>
      <h1 className="font-heading text-3xl text-blood-bright">
        Recensioni
      </h1>
      <p className="mt-2 text-sm text-bone/60">
        Testimonial mostrati in homepage. Solo le recensioni pubblicate
        sono visibili al pubblico.
      </p>

      <div className="mt-8">
        <ReviewsManager
          reviews={reviews.map((review) => ({
            id: review.id,
            author: review.author,
            quote: review.quote,
            rotation: review.rotation,
            sortOrder: review.sortOrder,
            isPublished: review.isPublished,
            imageUrl: getReviewCoverUrl(review),
          }))}
        />
      </div>
    </main>
  );
}
