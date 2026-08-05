"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/app/_lib/prisma";
import { requireAdminWithRateLimit } from "@/app/_lib/admin/rate-limit";
import {
  deleteReviewSchema,
  reviewFormSchema,
} from "@/app/_lib/admin/schemas";
import {
  type AdminActionResult,
  formDataToObject,
} from "@/app/_lib/admin/action-result";

export async function upsertReview(
  prevState: AdminActionResult | null,
  formData: FormData,
): Promise<AdminActionResult> {
  const gate = await requireAdminWithRateLimit("admin-reviews");
  if (!gate.ok) return gate.result;

  const parsed = reviewFormSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Input non valido",
    };
  }

  const { id, author, quote, rotation, sortOrder, isPublished } = parsed.data;

  try {
    if (id) {
      await prisma.review.update({
        where: { id },
        data: { author, quote, rotation, sortOrder, isPublished },
      });
    } else {
      await prisma.review.create({
        data: { author, quote, rotation, sortOrder, isPublished },
      });
    }

    revalidatePath("/admin/reviews");
    revalidatePath("/");
    revalidateTag("reviews", "max");

    return {
      success: true,
      message: id ? "Recensione aggiornata" : "Recensione creata",
    };
  } catch (error) {
    console.error("[admin/upsertReview]", error);
    return { success: false, error: "Errore durante il salvataggio della recensione" };
  }
}

export async function deleteReview(
  prevState: AdminActionResult | null,
  formData: FormData,
): Promise<AdminActionResult> {
  const gate = await requireAdminWithRateLimit("admin-reviews");
  if (!gate.ok) return gate.result;

  const parsed = deleteReviewSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Recensione non valida",
    };
  }

  try {
    await prisma.review.delete({ where: { id: parsed.data.reviewId } });
    revalidatePath("/admin/reviews");
    revalidatePath("/");
    revalidateTag("reviews", "max");

    return { success: true, message: "Recensione eliminata" };
  } catch (error) {
    console.error("[admin/deleteReview]", error);
    return { success: false, error: "Errore durante l'eliminazione della recensione" };
  }
}
