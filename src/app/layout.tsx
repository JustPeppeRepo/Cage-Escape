import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Anton } from "next/font/google";
import { env } from "@/app/_lib/env";
import { MAINTENANCE } from "@/app/_lib/site/maintenance";
import {
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_OG_DESCRIPTION,
  SITE_OG_TITLE,
} from "@/app/_lib/site/seo";
import { SiteNav } from "@/components/horror/SiteNav";
import { FloatingActions } from "@/components/horror/FloatingActions";
import { Iubenda } from "@/components/horror/Iubenda";
import { DemoRunner } from "@/components/DemoRunner";
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
  applicationName: SITE_NAME,
  title: {
    default: maintenanceOn
      ? `${MAINTENANCE.brand} — ${MAINTENANCE.headline}`
      : "Cage Escape Room — Escape Room Immersive | Prenota online",
    template: `%s | ${SITE_NAME}`,
  },
  description: maintenanceOn ? MAINTENANCE.message : SITE_DESCRIPTION,
  keywords: [...SITE_KEYWORDS],
  openGraph: {
    type: "website",
    locale: "it_IT",
    siteName: SITE_NAME,
    title: maintenanceOn
      ? `${MAINTENANCE.brand} — ${MAINTENANCE.headline}`
      : SITE_OG_TITLE,
    description: maintenanceOn ? MAINTENANCE.message : SITE_OG_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: maintenanceOn
      ? `${MAINTENANCE.brand} — ${MAINTENANCE.headline}`
      : SITE_OG_TITLE,
    description: maintenanceOn ? MAINTENANCE.message : SITE_OG_DESCRIPTION,
  },
  robots: maintenanceOn
    ? { index: false, follow: false }
    : { index: true, follow: true },
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
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-100 focus:rounded focus:bg-blood focus:px-4 focus:py-2 focus:text-bone focus:outline-none focus:ring-2 focus:ring-blood-bright"
        >
          Vai al contenuto principale
        </a>
        {!maintenanceOn ? <SiteNav /> : null}
        {children}
        <DemoRunner />
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
