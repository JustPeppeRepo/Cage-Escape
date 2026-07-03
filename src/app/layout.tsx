import type { Metadata } from "next";
import { Creepster } from "next/font/google";
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
  title: "Cage Room — Escape Room Horror",
  description:
    "Escape room a tema horror. Sopravvivi 90 minuti tra enigmi e terrore puro, se ci riesci.",
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
