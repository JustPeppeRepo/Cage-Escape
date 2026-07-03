"use server";

import { revalidatePath } from "next/cache";
import { BookingStatus } from "@/generated/prisma/client";
import { prisma } from "@/app/_lib/prisma";
import { requireAdmin } from "@/lib/dal";
import { cancelBookingSchema } from "@/app/_lib/admin/schemas";
import {
  type AdminActionResult,
  formDataToObject,
} from "@/app/_lib/admin/action-result";

export async function cancelBooking(
  prevState: AdminActionResult | null,
  formData: FormData,
): Promise<AdminActionResult> {
  await requireAdmin();

  const parsed = cancelBookingSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Input non valido",
    };
  }

  const { bookingId } = parsed.data;

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { status: true },
    });

    if (!booking) {
      return { success: false, error: "Prenotazione non trovata" };
    }

    if (
      booking.status === BookingStatus.COMPLETED ||
      booking.status === BookingStatus.CANCELLED
    ) {
      return {
        success: false,
        error: "Questa prenotazione non può essere annullata",
      };
    }

    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
        holdExpiresAt: null,
      },
    });

    revalidatePath("/admin/bookings");
    revalidatePath("/admin");

    return { success: true, message: "Prenotazione annullata" };
  } catch (error) {
    console.error("[admin/cancelBooking]", error);
    return { success: false, error: "Errore durante l'annullamento" };
  }
}
