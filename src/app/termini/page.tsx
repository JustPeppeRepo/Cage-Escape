import type { Metadata } from "next";
import { LegalPlaceholderPage } from "@/components/horror/legal/LegalPlaceholderPage";

export const metadata: Metadata = {
  title: "Termini e condizioni",
  description:
    "Termini e condizioni di prenotazione di Cage Escape Room. Documento in fase di pubblicazione.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/termini" },
};

export default function TerminiPage() {
  return (
    <LegalPlaceholderPage
      title="Termini e condizioni"
      description="Questa pagina ospiterà i termini di prenotazione, recesso e condizioni di fruizione del servizio, pubblicati tramite iubenda."
    />
  );
}
