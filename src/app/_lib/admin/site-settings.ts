import { prisma } from "@/app/_lib/prisma";

export const SITE_SETTINGS_ID = "default";

export type SiteSettingsData = {
  easterEggDiscountEnabled: boolean;
  easterEggDiscountPercent: number;
};

export async function getSiteSettings(): Promise<SiteSettingsData> {
  const settings = await prisma.siteSettings.upsert({
    where: { id: SITE_SETTINGS_ID },
    update: {},
    create: {
      id: SITE_SETTINGS_ID,
      easterEggDiscountEnabled: false,
      easterEggDiscountPercent: 5,
    },
  });

  return {
    easterEggDiscountEnabled: settings.easterEggDiscountEnabled,
    easterEggDiscountPercent: settings.easterEggDiscountPercent,
  };
}
