"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { ScheduleOverrideType } from "@/generated/prisma/client";
import { prisma } from "@/app/_lib/prisma";
import { requireAdmin } from "@/lib/dal";
import {
  deleteScheduleOverrideSchema,
  scheduleOverrideFormSchema,
  weeklyOpeningHoursFormSchema,
} from "@/app/_lib/admin/schemas";
import {
  type AdminActionResult,
  formDataToObject,
} from "@/app/_lib/admin/action-result";
import { ensureWeeklyOpeningHours } from "@/app/_lib/bookings/weekly-hours";

function isPrismaKnownError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

function parseOverrideDates(formData: FormData): string[] {
  return Array.from(
    new Set(
      formData
        .getAll("dates")
        .map(String)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ).sort();
}

export async function upsertScheduleOverride(
  prevState: AdminActionResult | null,
  formData: FormData,
): Promise<AdminActionResult> {
  await requireAdmin();

  const parsed = scheduleOverrideFormSchema.safeParse({
    ...formDataToObject(formData),
    dates: parseOverrideDates(formData),
  });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Input non valido",
    };
  }

  const { id, dates, roomId, type, openHour, closeHour, reason } = parsed.data;
  const normalizedRoomId = roomId && roomId.length > 0 ? roomId : null;
  const reasonValue = reason?.trim() || null;
  const hours =
    type === ScheduleOverrideType.CUSTOM_HOURS
      ? { openHour: openHour!, closeHour: closeHour! }
      : { openHour: null, closeHour: null };

  try {
    if (id) {
      if (dates.length !== 1) {
        return {
          success: false,
          error: "L'aggiornamento di un override singolo richiede una sola data",
        };
      }

      await prisma.scheduleOverride.update({
        where: { id },
        data: {
          date: new Date(`${dates[0]}T00:00:00.000Z`),
          roomId: normalizedRoomId,
          type,
          ...hours,
          reason: reasonValue,
        },
      });

      revalidatePath("/admin/schedule");
      return { success: true, message: "Override aggiornato" };
    }

    await prisma.$transaction(async (tx) => {
      for (const date of dates) {
        const dateValue = new Date(`${date}T00:00:00.000Z`);
        const existing = await tx.scheduleOverride.findFirst({
          where: {
            date: dateValue,
            roomId: normalizedRoomId,
          },
        });

        if (existing) {
          await tx.scheduleOverride.update({
            where: { id: existing.id },
            data: {
              type,
              ...hours,
              reason: reasonValue,
            },
          });
        } else {
          await tx.scheduleOverride.create({
            data: {
              date: dateValue,
              roomId: normalizedRoomId,
              type,
              ...hours,
              reason: reasonValue,
            },
          });
        }
      }
    });

    revalidatePath("/admin/schedule");

    return {
      success: true,
      message:
        dates.length === 1
          ? "Override creato"
          : `${dates.length} override creati/aggiornati`,
    };
  } catch (error) {
    if (isPrismaKnownError(error) && error.code === "P2002") {
      return {
        success: false,
        error: "Esiste già un override per una di queste date e stanza",
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

function parseWeeklyHoursForm(formData: FormData) {
  const days = Array.from({ length: 7 }, (_, dayOfWeek) => {
    const isOpenRaw = formData.get(`day_${dayOfWeek}_isOpen`);
    return {
      dayOfWeek,
      isOpen: isOpenRaw === "true" || isOpenRaw === "on",
      openHour: formData.get(`day_${dayOfWeek}_openHour`),
      closeHour: formData.get(`day_${dayOfWeek}_closeHour`),
    };
  });

  return weeklyOpeningHoursFormSchema.safeParse({ days });
}

export async function updateWeeklyOpeningHours(
  prevState: AdminActionResult | null,
  formData: FormData,
): Promise<AdminActionResult> {
  await requireAdmin();

  const parsed = parseWeeklyHoursForm(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Input non valido",
    };
  }

  try {
    await ensureWeeklyOpeningHours();

    await prisma.$transaction(
      parsed.data.days.map((day) =>
        prisma.weeklyOpeningHours.update({
          where: { dayOfWeek: day.dayOfWeek },
          data: {
            isOpen: day.isOpen,
            openHour: day.openHour,
            closeHour: day.closeHour,
          },
        }),
      ),
    );

    revalidatePath("/admin/schedule");
    return { success: true, message: "Orari settimanali aggiornati" };
  } catch (error) {
    console.error("[admin/updateWeeklyOpeningHours]", error);
    return {
      success: false,
      error: "Errore durante il salvataggio degli orari settimanali",
    };
  }
}
