/**
 * Cookie Policy `/cookie`
 *
 * @description Placeholder cookie (iubenda quando configurato).
 * @components LegalPlaceholderPage → SiteFooter
 * @seo noindex, follow
 */
import type { Metadata } from "next";
import { LegalPlaceholderPage } from "@/components/horror/legal/LegalPlaceholderPage";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description:
    "Informativa sui cookie di Cage Escape Room. Documento in fase di pubblicazione.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/cookie" },
  openGraph: {
    title: "Cookie Policy | Cage Escape Room",
    description:
      "Informativa sui cookie di Cage Escape Room. Documento in fase di pubblicazione.",
    url: "/cookie",
  },
};

export default function CookiePage() {
  return (
    <LegalPlaceholderPage
      title="Cookie Policy"
      description="Questa pagina ospiterà la cookie policy generata con iubenda, insieme al banner di consenso quando l'integrazione sarà attiva."
    />
  );
}
