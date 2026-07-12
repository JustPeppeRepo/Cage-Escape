import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Anton } from "next/font/google";
import { env } from "@/app/_lib/env";
import { SiteNav } from "@/components/horror/SiteNav";
import { SiteNavShell } from "@/components/horror/SiteNavShell";
import "./globals.css";

const displayFont = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display-heading",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: {
    default: "Cage Room — Escape Room Horror",
    template: "%s",
  },
  description:
    "Escape room a tema horror. Sopravvivi 90 minuti tra enigmi e terrore puro, se ci riesci.",
  openGraph: {
    type: "website",
    locale: "it_IT",
    siteName: "Cage Room",
    title: "Cage Room — Escape Room Horror",
    description:
      "Prenota la tua escape room a tema horror. Enigmi, terrore e 90 minuti per sopravvivere.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cage Room — Escape Room Horror",
    description:
      "Prenota la tua escape room a tema horror. Enigmi, terrore e 90 minuti per sopravvivere.",
  },
  robots: {
    index: true,
    follow: true,
  },
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
        <SiteNavShell>
          <SiteNav />
        </SiteNavShell>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
