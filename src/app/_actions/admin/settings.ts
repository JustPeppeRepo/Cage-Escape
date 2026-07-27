"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/app/_lib/prisma";
import { requireAdmin } from "@/lib/dal";
import { siteSettingsFormSchema } from "@/app/_lib/admin/schemas";
import { SITE_SETTINGS_ID } from "@/app/_lib/admin/site-settings";
import {
  type AdminActionResult,
  formDataToObject,
} from "@/app/_lib/admin/action-result";

export async function updateSiteSettings(
  prevState: AdminActionResult | null,
  formData: FormData,
): Promise<AdminActionResult> {
  await requireAdmin();

  const parsed = siteSettingsFormSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Input non valido",
    };
  }

  const {
    easterEggDiscountEnabled,
    easterEggDiscountPercent,
    slotCooldownMinutes,
  } = parsed.data;

  try {
    await prisma.siteSettings.upsert({
      where: { id: SITE_SETTINGS_ID },
      update: {
        easterEggDiscountEnabled,
        easterEggDiscountPercent,
        slotCooldownMinutes,
      },
      create: {
        id: SITE_SETTINGS_ID,
        easterEggDiscountEnabled,
        easterEggDiscountPercent,
        slotCooldownMinutes,
      },
    });

    revalidatePath("/admin/impostazioni");
    revalidatePath("/admin/schedule");
    revalidatePath("/maledizione");

    return { success: true, message: "Impostazioni salvate" };
  } catch (error) {
    console.error("[admin/updateSiteSettings]", error);
    return { success: false, error: "Errore durante il salvataggio delle impostazioni" };
  }
}
