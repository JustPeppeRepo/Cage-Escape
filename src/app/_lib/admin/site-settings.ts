import { prisma } from "@/app/_lib/prisma";
import { DEFAULT_SLOT_COOLDOWN_MINUTES } from "@/app/_lib/bookings/constants";
import { logError } from "@/lib/logger";

export const SITE_SETTINGS_ID = "default";

export type SiteSettingsData = {
  easterEggDiscountEnabled: boolean;
  easterEggDiscountPercent: number;
  slotCooldownMinutes: number;
};

export async function getSiteSettings(): Promise<SiteSettingsData> {
  try {
    const settings = await prisma.siteSettings.upsert({
      where: { id: SITE_SETTINGS_ID },
      update: {},
      create: {
        id: SITE_SETTINGS_ID,
        easterEggDiscountEnabled: false,
        easterEggDiscountPercent: 5,
        slotCooldownMinutes: DEFAULT_SLOT_COOLDOWN_MINUTES,
      },
    });

    return {
      easterEggDiscountEnabled: settings.easterEggDiscountEnabled,
      easterEggDiscountPercent: settings.easterEggDiscountPercent,
      slotCooldownMinutes:
        settings.slotCooldownMinutes ?? DEFAULT_SLOT_COOLDOWN_MINUTES,
    };
  } catch (error) {
    logError("site-settings", "getSiteSettings failed, using defaults", {
      message: error instanceof Error ? error.message : String(error),
    });

    return {
      easterEggDiscountEnabled: false,
      easterEggDiscountPercent: 5,
      slotCooldownMinutes: DEFAULT_SLOT_COOLDOWN_MINUTES,
    };
  }
}

export async function getSlotCooldownMinutes(): Promise<number> {
  const settings = await getSiteSettings();
  return settings.slotCooldownMinutes;
}
