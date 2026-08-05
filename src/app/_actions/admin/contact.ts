"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/app/_lib/prisma";
import { requireAdminWithRateLimit } from "@/app/_lib/admin/rate-limit";
import {
  contactMessageIdSchema,
  setContactMessageReadSchema,
} from "@/app/_lib/admin/schemas";
import {
  type AdminActionResult,
  formDataToObject,
} from "@/app/_lib/admin/action-result";

export async function setContactMessageRead(
  prevState: AdminActionResult | null,
  formData: FormData,
): Promise<AdminActionResult> {
  const gate = await requireAdminWithRateLimit("admin-contact");
  if (!gate.ok) return gate.result;

  const parsed = setContactMessageReadSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Messaggio non valido",
    };
  }

  try {
    await prisma.contactMessage.update({
      where: { id: parsed.data.messageId },
      data: { read: parsed.data.read },
    });

    revalidatePath("/admin/contatti");

    return {
      success: true,
      message: parsed.data.read ? "Segnato come letto" : "Segnato come da leggere",
    };
  } catch (error) {
    console.error("[admin/setContactMessageRead]", error);
    return { success: false, error: "Errore durante l'aggiornamento del messaggio" };
  }
}

export async function deleteContactMessage(
  prevState: AdminActionResult | null,
  formData: FormData,
): Promise<AdminActionResult> {
  const gate = await requireAdminWithRateLimit("admin-contact");
  if (!gate.ok) return gate.result;

  const parsed = contactMessageIdSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Messaggio non valido",
    };
  }

  try {
    await prisma.contactMessage.delete({ where: { id: parsed.data.messageId } });
    revalidatePath("/admin/contatti");
    return { success: true, message: "Messaggio eliminato" };
  } catch (error) {
    console.error("[admin/deleteContactMessage]", error);
    return { success: false, error: "Errore durante l'eliminazione del messaggio" };
  }
}
