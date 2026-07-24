import type { Metadata } from "next";
import { requireAdmin } from "@/lib/dal";
import { getSiteSettings } from "@/app/_lib/admin/site-settings";
import { SiteSettingsForm } from "@/components/admin/SiteSettingsForm";

export const metadata: Metadata = {
  title: "Impostazioni | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await getSiteSettings();

  return (
    <main>
      <h1 className="font-heading text-3xl text-blood-bright">
        Impostazioni
      </h1>
      <p className="mt-2 text-sm text-bone/60">
        Configurazione dello sconto per il mini-gioco &quot;Il Rito della Maledizione&quot;.
      </p>

      <div className="mt-8">
        <SiteSettingsForm
          easterEggDiscountEnabled={settings.easterEggDiscountEnabled}
          easterEggDiscountPercent={settings.easterEggDiscountPercent}
        />
      </div>
    </main>
  );
}
