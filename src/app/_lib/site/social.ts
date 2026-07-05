export const SOCIAL_LINKS = [
  {
    id: "instagram",
    label: "Instagram",
    href: "https://www.instagram.com/cageroom",
  },
  {
    id: "facebook",
    label: "Facebook",
    href: "https://www.facebook.com/cageroom",
  },
  {
    id: "tiktok",
    label: "TikTok",
    href: "https://www.tiktok.com/@cageroom",
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    href: "https://wa.me/393000000000",
  },
] as const;

export type SocialLinkId = (typeof SOCIAL_LINKS)[number]["id"];
