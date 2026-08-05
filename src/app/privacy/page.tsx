/**
 * Privacy Policy `/privacy`
 *
 * @description Placeholder legale (iubenda quando configurato).
 * @components LegalPlaceholderPage → SiteFooter
 * @seo noindex, follow
 */
import type { Metadata } from "next";
import { LegalPlaceholderPage } from "@/components/horror/legal/LegalPlaceholderPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Informativa sulla privacy di Cage Escape Room. Documento in fase di pubblicazione.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy | Cage Escape Room",
    description:
      "Informativa sulla privacy di Cage Escape Room. Documento in fase di pubblicazione.",
    url: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <LegalPlaceholderPage
      title="Privacy Policy"
      description="Questa pagina ospiterà l'informativa sulla privacy generata con iubenda. I dati del titolare del trattamento sono riportati di seguito."
    />
  );
}
