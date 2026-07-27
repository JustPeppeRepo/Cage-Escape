import { env } from "@/app/_lib/env";

/**
 * Dati societari e link legali del sito.
 *
 * Le policy complete (Privacy / Cookie / Termini) vanno gestite con iubenda:
 * imposta gli ID in env e i link del footer puntano agli embed ufficiali.
 * Finché gli ID mancano, i link usano le pagine locali di attesa.
 */

export const LEGAL_ENTITY = {
  legalName: "CAGE di Aiello Girolamo Emanuele",
  vatNumber: "07339710829",
  legalForm: "Impresa individuale",
} as const;

export type LegalLinkId = "privacy" | "cookie" | "terms";

export type LegalLink = {
  id: LegalLinkId;
  label: string;
  href: string;
  /** Se true, il link usa le classi embed iubenda (apre il widget). */
  iubendaEmbed: boolean;
};

export function getIubendaConfig() {
  const siteId = env.NEXT_PUBLIC_IUBENDA_SITE_ID;
  const privacyPolicyId = env.NEXT_PUBLIC_IUBENDA_PRIVACY_POLICY_ID;
  const termsId = env.NEXT_PUBLIC_IUBENDA_TERMS_ID;

  return {
    siteId,
    privacyPolicyId,
    termsId,
    isConfigured: Boolean(siteId && privacyPolicyId),
  };
}

export function getLegalLinks(): LegalLink[] {
  const { privacyPolicyId, termsId } = getIubendaConfig();

  return [
    {
      id: "privacy",
      label: "Privacy Policy",
      href: privacyPolicyId
        ? `https://www.iubenda.com/privacy-policy/${privacyPolicyId}`
        : "/privacy",
      iubendaEmbed: Boolean(privacyPolicyId),
    },
    {
      id: "cookie",
      label: "Cookie Policy",
      href: privacyPolicyId
        ? `https://www.iubenda.com/privacy-policy/${privacyPolicyId}/cookie-policy`
        : "/cookie",
      iubendaEmbed: Boolean(privacyPolicyId),
    },
    {
      id: "terms",
      label: "Termini e condizioni",
      href: termsId
        ? `https://www.iubenda.com/termini-e-condizioni/${termsId}`
        : "/termini",
      iubendaEmbed: Boolean(termsId),
    },
  ];
}
