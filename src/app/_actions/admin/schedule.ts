"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { ScheduleOverrideType } from "@/generated/prisma/client";
import { prisma } from "@/app/_lib/prisma";
import { requireAdmin } from "@/lib/dal";
import {
  deleteScheduleOverrideSchema,
  scheduleOverrideFormSchema,
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

export async function upsertScheduleOverride(
  prevState: AdminActionResult | null,
  formData: FormData,
): Promise<AdminActionResult> {
  await requireAdmin();

  const parsed = scheduleOverrideFormSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Input non valido",
    };
  }

  const { id, date, roomId, type, openHour, closeHour, reason } = parsed.data;
  const normalizedRoomId = roomId && roomId.length > 0 ? roomId : null;
  const dateValue = new Date(`${date}T00:00:00.000Z`);

  const data = {
    date: dateValue,
    roomId: normalizedRoomId,
    type,
    openHour: type === ScheduleOverrideType.CUSTOM_HOURS ? openHour : null,
    closeHour: type === ScheduleOverrideType.CUSTOM_HOURS ? closeHour : null,
    reason: reason?.trim() || null,
  };

  try {
    if (id) {
      await prisma.scheduleOverride.update({
        where: { id },
        data,
      });
    } else {
      await prisma.scheduleOverride.create({ data });
    }

    revalidatePath("/admin/schedule");

    return {
      success: true,
      message: id ? "Override aggiornato" : "Override creato",
    };
  } catch (error) {
    if (isPrismaKnownError(error) && error.code === "P2002") {
      return {
        success: false,
        error: "Esiste già un override per questa data e stanza",
      };
    }
    console.error("[admin/upsertScheduleOverride]", error);
    return { success: false, error: "Errore durante il salvataggio dell'override" };
  }
}

export async function deleteScheduleOverride(
  prevState: AdminActionResult | null,
  formData: FormData,
): Promise<AdminActionResult> {
  await requireAdmin();

  const parsed = deleteScheduleOverrideSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return { success: false, error: "Override non valido" };
  }

  const { overrideId } = parsed.data;

  try {
    await prisma.scheduleOverride.delete({ where: { id: overrideId } });
    revalidatePath("/admin/schedule");
    return { success: true, message: "Override eliminato" };
  } catch (error) {
    console.error("[admin/deleteScheduleOverride]", error);
    return { success: false, error: "Errore durante l'eliminazione dell'override" };
  }
}
