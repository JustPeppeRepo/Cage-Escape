import type { Metadata } from "next";
import { Creepster } from "next/font/google";
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" className={gothicDisplay.variable}>
      <body>{children}</body>
    </html>
  );
}
