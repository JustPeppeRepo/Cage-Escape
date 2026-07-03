import type { Metadata, Viewport } from "next";
import { Creepster } from "next/font/google";
import { env } from "@/app/_lib/env";
import { getCurrentSession } from "@/lib/dal";
import { SiteNav } from "@/components/horror/SiteNav";
import { SiteNavShell } from "@/components/horror/SiteNavShell";
import "./globals.css";

const gothicDisplay = Creepster({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-gothic-display",
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

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getCurrentSession();
  const navUser = session?.user
    ? {
        name: session.user.name,
        email: session.user.email,
        isAdmin: session.user.role === "ADMIN",
      }
    : null;

  return (
    <html lang="it" className={gothicDisplay.variable}>
      <body>
        <SiteNavShell>
          <SiteNav user={navUser} />
        </SiteNavShell>
        {children}
      </body>
    </html>
  );
}
