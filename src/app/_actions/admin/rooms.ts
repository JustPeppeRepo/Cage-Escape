"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { BookingStatus } from "@/generated/prisma/client";
import { prisma } from "@/app/_lib/prisma";
import { requireAdmin } from "@/lib/dal";
import {
  pricingTierFormSchema,
  roomFormSchema,
} from "@/app/_lib/admin/schemas";
import {
  type AdminActionResult,
  formDataToObject,
} from "@/app/_lib/admin/action-result";

function isPrismaKnownError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

export async function upsertRoom(
  prevState: AdminActionResult | null,
  formData: FormData,
): Promise<AdminActionResult> {
  await requireAdmin();

  const parsed = roomFormSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Input non valido",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const {
    id,
    slug,
    name,
    description,
    prezzoTotale,
    prezzoCaparra,
    durationMinutes,
    minPlayers,
    maxPlayers,
    terrorLevel,
    isActive,
  } = parsed.data;

  if (minPlayers > maxPlayers) {
    return {
      success: false,
      error: "Il minimo giocatori non può superare il massimo",
    };
  }

  if (prezzoCaparra > prezzoTotale) {
    return {
      success: false,
      error: "La caparra non può superare il prezzo totale indicativo",
    };
  }

  try {
    if (id) {
      await prisma.room.update({
        where: { id },
        data: {
          slug,
          name,
          description,
          prezzoTotale,
          prezzoCaparra,
          durationMinutes,
          minPlayers,
          maxPlayers,
          terrorLevel,
          isActive,
        },
      });
    } else {
      await prisma.room.create({
        data: {
          slug,
          name,
          description,
          prezzoTotale,
          prezzoCaparra,
          durationMinutes,
          minPlayers,
          maxPlayers,
          terrorLevel,
          isActive,
        },
      });
    }

    revalidatePath("/admin/rooms");
    revalidatePath("/");
    revalidatePath("/rooms");

    return {
      success: true,
      message: id ? "Stanza aggiornata" : "Stanza creata",
    };
  } catch (error) {
    if (isPrismaKnownError(error) && error.code === "P2002") {
      return { success: false, error: "Slug già in uso" };
    }
    console.error("[admin/upsertRoom]", error);
    return { success: false, error: "Errore durante il salvataggio della stanza" };
  }
}

export async function deleteRoom(
  prevState: AdminActionResult | null,
  formData: FormData,
): Promise<AdminActionResult> {
  await requireAdmin();

  const roomId = formData.get("roomId");
  if (typeof roomId !== "string" || !roomId) {
    return { success: false, error: "Stanza non valida" };
  }

  try {
    const activeBookings = await prisma.booking.count({
      where: {
        roomId,
        status: {
          in: [
            BookingStatus.PENDING,
            BookingStatus.DEPOSIT_PAID,
            BookingStatus.PAID,
          ],
        },
      },
    });

    if (activeBookings > 0) {
      return {
        success: false,
        error: "Impossibile eliminare: esistono prenotazioni attive su questa stanza",
      };
    }

    await prisma.room.delete({ where: { id: roomId } });

    revalidatePath("/admin/rooms");
    revalidatePath("/");
    revalidatePath("/rooms");

    return { success: true, message: "Stanza eliminata" };
  } catch (error) {
    console.error("[admin/deleteRoom]", error);
    return { success: false, error: "Errore durante l'eliminazione della stanza" };
  }
}

export async function upsertPricingTier(
  prevState: AdminActionResult | null,
  formData: FormData,
): Promise<AdminActionResult> {
  await requireAdmin();

  const parsed = pricingTierFormSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Input non valido",
    };
  }

  const {
    roomId,
    tierId,
    minParticipants,
    maxParticipants,
    totalPrice,
    depositPrice,
  } = parsed.data;

  if (minParticipants > maxParticipants) {
    return {
      success: false,
      error: "Il minimo partecipanti non può superare il massimo",
    };
  }

  if (depositPrice > totalPrice) {
    return {
      success: false,
      error: "La caparra non può superare il prezzo totale della fascia",
    };
  }

  try {
    if (tierId) {
      await prisma.roomPricingTier.update({
        where: { id: tierId },
        data: {
          minParticipants,
          maxParticipants,
          totalPrice,
          depositPrice,
        },
      });
    } else {
      await prisma.roomPricingTier.create({
        data: {
          roomId,
          minParticipants,
          maxParticipants,
          totalPrice,
          depositPrice,
        },
      });
    }

    revalidatePath("/admin/rooms");
    revalidatePath(`/admin/rooms/${roomId}`);

    return {
      success: true,
      message: tierId ? "Fascia aggiornata" : "Fascia creata",
    };
  } catch (error) {
    if (isPrismaKnownError(error) && error.code === "P2002") {
      return {
        success: false,
        error: "Esiste già una fascia con questo intervallo di partecipanti",
      };
    }
    console.error("[admin/upsertPricingTier]", error);
    return { success: false, error: "Errore durante il salvataggio della fascia" };
  }
}

export async function deletePricingTier(
  prevState: AdminActionResult | null,
  formData: FormData,
): Promise<AdminActionResult> {
  await requireAdmin();

  const tierId = formData.get("tierId");
  const roomId = formData.get("roomId");

  if (typeof tierId !== "string" || !tierId) {
    return { success: false, error: "Fascia non valida" };
  }

  try {
    await prisma.roomPricingTier.delete({ where: { id: tierId } });

    revalidatePath("/admin/rooms");
    if (typeof roomId === "string" && roomId) {
      revalidatePath(`/admin/rooms/${roomId}`);
    }

    return { success: true, message: "Fascia eliminata" };
  } catch (error) {
    console.error("[admin/deletePricingTier]", error);
    return { success: false, error: "Errore durante l'eliminazione della fascia" };
  }
}
