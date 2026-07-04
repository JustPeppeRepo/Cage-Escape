export const AVATARS = [
  { id: "skull", label: "Teschio", url: "/avatars/skull.svg" },
  { id: "ghost", label: "Fantasma", url: "/avatars/ghost.svg" },
  { id: "bat", label: "Pipistrello", url: "/avatars/bat.svg" },
  { id: "crow", label: "Corvo", url: "/avatars/crow.svg" },
  { id: "moon", label: "Luna", url: "/avatars/moon.svg" },
  { id: "candle", label: "Candela", url: "/avatars/candle.svg" },
  { id: "mask", label: "Maschera", url: "/avatars/mask.svg" },
  { id: "raven", label: "Corvo nero", url: "/avatars/raven.svg" },
] as const;

export type AvatarId = (typeof AVATARS)[number]["id"];

export const AVATAR_IDS = AVATARS.map((avatar) => avatar.id) as [
  AvatarId,
  ...AvatarId[],
];

const avatarById = new Map<string, (typeof AVATARS)[number]>(
  AVATARS.map((avatar) => [avatar.id, avatar]),
);
const avatarByUrl = new Map<string, (typeof AVATARS)[number]>(
  AVATARS.map((avatar) => [avatar.url, avatar]),
);

export function getAvatarUrlById(id: AvatarId): string {
  return avatarById.get(id)!.url;
}

export function resolveAvatarId(image: string | null | undefined): AvatarId {
  if (image && avatarByUrl.has(image)) {
    return avatarByUrl.get(image)!.id;
  }

  return AVATARS[0].id;
}
