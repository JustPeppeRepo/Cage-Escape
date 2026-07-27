import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Anton } from "next/font/google";
import { env } from "@/app/_lib/env";
import { MAINTENANCE } from "@/app/_lib/site/maintenance";
import { SiteNav } from "@/components/horror/SiteNav";
import { FloatingActions } from "@/components/horror/FloatingActions";
import { Iubenda } from "@/components/horror/Iubenda";
import "./globals.css";

const displayFont = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display-heading",
  display: "swap",
});

const maintenanceOn = MAINTENANCE.enabled;

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: {
    default: maintenanceOn
      ? `${MAINTENANCE.brand} — ${MAINTENANCE.headline}`
      : "Cage Escape Room — Escape Room Immersive | Prenota online",
    template: "%s | Cage Escape Room",
  },
  description: maintenanceOn
    ? MAINTENANCE.message
    : "Cage Escape Room: escape room immersive con temi diversi, dall'avventura all'horror. Prenota online e vivi 90 minuti di enigmi fuori dal mondo.",
  openGraph: {
    type: "website",
    locale: "it_IT",
    siteName: "Cage Escape Room",
    title: maintenanceOn
      ? `${MAINTENANCE.brand} — ${MAINTENANCE.headline}`
      : "Cage Escape Room — Escape Room Immersive",
    description: maintenanceOn
      ? MAINTENANCE.message
      : "Prenota la tua escape room da Cage Escape Room. Esperienze immersive a tema — anche horror — con enigmi e 90 minuti per uscirne.",
  },
  twitter: {
    card: "summary_large_image",
    title: maintenanceOn
      ? `${MAINTENANCE.brand} — ${MAINTENANCE.headline}`
      : "Cage Escape Room — Escape Room Immersive",
    description: maintenanceOn
      ? MAINTENANCE.message
      : "Prenota la tua escape room da Cage Escape Room. Esperienze immersive a tema — anche horror — con enigmi e 90 minuti per uscirne.",
  },
  robots: maintenanceOn
    ? { index: false, follow: false }
    : { index: true, follow: true },
  alternates: {
    canonical: "/",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" className={displayFont.variable}>
      <body>
        {!maintenanceOn ? <SiteNav /> : null}
        {children}
        {!maintenanceOn ? <FloatingActions /> : null}
        {!maintenanceOn &&
        env.NEXT_PUBLIC_IUBENDA_SITE_ID &&
        env.NEXT_PUBLIC_IUBENDA_PRIVACY_POLICY_ID ? (
          <Iubenda
            siteId={env.NEXT_PUBLIC_IUBENDA_SITE_ID}
            cookiePolicyId={env.NEXT_PUBLIC_IUBENDA_PRIVACY_POLICY_ID}
          />
        ) : null}
        {!maintenanceOn ? <Analytics /> : null}
        {!maintenanceOn ? <SpeedInsights /> : null}
      </body>
    </html>
  );
}
