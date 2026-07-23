export const SOCIAL_LINKS = [
  {
    id: "instagram",
    label: "Instagram",
    href: "https://www.instagram.com/cageroom.it",
  },
  {
    id: "facebook",
    label: "Facebook",
    href: "https://www.facebook.com/p/CAGE-Escape-Room-61579651813352",
  },
  {
    id: "tiktok",
    label: "TikTok",
    href: "https://www.tiktok.com/@cageroom.it",
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    href: "https://wa.me/393929375672",
  },
] as const;

export type SocialLinkId = (typeof SOCIAL_LINKS)[number]["id"];
