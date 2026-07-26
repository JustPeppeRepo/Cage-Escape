import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MAINTENANCE } from "@/app/_lib/site/maintenance";
import { MaintenanceScreen } from "@/components/horror/MaintenanceScreen";

export const metadata: Metadata = {
  title: {
    absolute: `${MAINTENANCE.brand} — ${MAINTENANCE.headline}`,
  },
  description: MAINTENANCE.message,
  robots: {
    index: false,
    follow: false,
  },
};

export default function ManutenzionePage() {
  if (!MAINTENANCE.enabled) {
    redirect("/");
  }

  return <MaintenanceScreen />;
}
