import type { Metadata } from "next";
import { prisma } from "@/app/_lib/prisma";
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
  });

  return (
    <main>
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-blood-bright">
        Recensioni
      </h1>
      <p className="mt-2 text-sm text-bone/60">
        Testimonial polaroid mostrati in homepage. Solo le recensioni pubblicate
        sono visibili al pubblico.
      </p>

      <div className="mt-8">
        <ReviewsManager reviews={reviews} />
      </div>
    </main>
  );
}
