import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Anton } from "next/font/google";
import { env } from "@/app/_lib/env";
import { SiteNav } from "@/components/horror/SiteNav";
import { SiteNavShell } from "@/components/horror/SiteNavShell";
import { WhatsAppFloat } from "@/components/horror/WhatsAppFloat";
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
    default: "Cage Escape Room — Escape Room Horror | Prenota online",
    template: "%s | Cage Escape Room",
  },
  description:
    "Cage Escape Room: escape room horror immersive. Prenota online e sopravvivi 90 minuti tra enigmi e terrore puro.",
  openGraph: {
    type: "website",
    locale: "it_IT",
    siteName: "Cage Escape Room",
    title: "Cage Escape Room — Escape Room Horror",
    description:
      "Prenota la tua escape room horror da Cage Escape Room. Enigmi, terrore e 90 minuti per sopravvivere.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cage Escape Room — Escape Room Horror",
    description:
      "Prenota la tua escape room horror da Cage Escape Room. Enigmi, terrore e 90 minuti per sopravvivere.",
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
        <WhatsAppFloat />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
