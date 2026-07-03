"use client";

import { useActionState } from "react";
import { deleteReview, upsertReview } from "@/app/_actions/admin/reviews";
import type { AdminActionResult } from "@/app/_lib/admin/action-result";
import {
  AdminFormFeedback,
  adminButtonClassName,
  adminInputClassName,
  adminLabelClassName,
  adminSecondaryButtonClassName,
} from "@/components/admin/AdminFormFeedback";

type ReviewRow = {
  id: string;
  author: string;
  quote: string;
  rotation: number;
  sortOrder: number;
  isPublished: boolean;
};

type ReviewsManagerProps = {
  reviews: ReviewRow[];
};

export function ReviewsManager({ reviews }: ReviewsManagerProps) {
  const [createState, createAction, createPending] = useActionState<
    AdminActionResult | null,
    FormData
  >(upsertReview, null);

  return (
    <div className="flex flex-col gap-8">
      <form
        action={createAction}
        className="flex flex-col gap-4 rounded border border-void-mist p-4"
      >
        <AdminFormFeedback state={createState} />
        <h3 className="text-lg text-bone">Nuova recensione</h3>

        <label className={adminLabelClassName}>
          Autore
          <input name="author" required maxLength={64} className={adminInputClassName} />
        </label>

        <label className={adminLabelClassName}>
          Testo
          <textarea
            name="quote"
            required
            minLength={5}
            maxLength={500}
            rows={3}
            className={adminInputClassName}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className={adminLabelClassName}>
            Rotazione (-10…10)
            <input
              name="rotation"
              type="number"
              min="-10"
              max="10"
              defaultValue={0}
              className={adminInputClassName}
            />
          </label>
          <label className={adminLabelClassName}>
            Ordine
            <input
              name="sortOrder"
              type="number"
              min="0"
              max="999"
              defaultValue={reviews.length}
              className={adminInputClassName}
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm text-bone/80">
          <input name="isPublished" type="checkbox" defaultChecked />
          Pubblicata in homepage
        </label>

        <button type="submit" disabled={createPending} className={adminButtonClassName}>
          {createPending ? "Salvataggio…" : "Crea recensione"}
        </button>
      </form>

      <div>
        <h3 className="mb-3 text-lg text-bone">Recensioni esistenti</h3>
        {reviews.length === 0 ? (
          <p className="text-sm text-bone/60">Nessuna recensione configurata.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {reviews.map((review) => (
              <ReviewRowItem key={review.id} review={review} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ReviewRowItem({ review }: { review: ReviewRow }) {
  const [updateState, updateAction, updatePending] = useActionState<
    AdminActionResult | null,
    FormData
  >(upsertReview, null);
  const [deleteState, deleteAction, deletePending] = useActionState<
    AdminActionResult | null,
    FormData
  >(deleteReview, null);

  return (
    <li className="rounded border border-void-mist p-4">
      <form action={updateAction} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={review.id} readOnly />
        <AdminFormFeedback state={updateState} />

        <label className={adminLabelClassName}>
          Autore
          <input
            name="author"
            required
            maxLength={64}
            defaultValue={review.author}
            className={adminInputClassName}
          />
        </label>

        <label className={adminLabelClassName}>
          Testo
          <textarea
            name="quote"
            required
            minLength={5}
            maxLength={500}
            rows={3}
            defaultValue={review.quote}
            className={adminInputClassName}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className={adminLabelClassName}>
            Rotazione (-10…10)
            <input
              name="rotation"
              type="number"
              min="-10"
              max="10"
              defaultValue={review.rotation}
              className={adminInputClassName}
            />
          </label>
          <label className={adminLabelClassName}>
            Ordine
            <input
              name="sortOrder"
              type="number"
              min="0"
              max="999"
              defaultValue={review.sortOrder}
              className={adminInputClassName}
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm text-bone/80">
          <input
            name="isPublished"
            type="checkbox"
            defaultChecked={review.isPublished}
          />
          Pubblicata in homepage
        </label>

        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={updatePending} className={adminButtonClassName}>
            {updatePending ? "Salvataggio…" : "Salva modifiche"}
          </button>
        </div>
      </form>

      <form action={deleteAction} className="mt-3 border-t border-void-mist pt-3">
        <input type="hidden" name="reviewId" value={review.id} readOnly />
        <AdminFormFeedback state={deleteState} />
        <button type="submit" disabled={deletePending} className={adminSecondaryButtonClassName}>
          {deletePending ? "Eliminazione…" : "Elimina"}
        </button>
      </form>
    </li>
  );
}
