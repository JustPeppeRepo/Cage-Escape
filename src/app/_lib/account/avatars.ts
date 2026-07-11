const AVATAR_IDS_LIST = [
  "alien",
  "inventor",
  "pirate",
  "samurai",
  "vampire",
] as const;

function avatarLabelFromId(id: string): string {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

export const AVATARS = AVATAR_IDS_LIST.map((id) => ({
  id,
  label: avatarLabelFromId(id),
  url: `/avatars/${id}.svg`,
}));

export type AvatarId = (typeof AVATAR_IDS_LIST)[number];

export const AVATAR_IDS = [...AVATAR_IDS_LIST] as [AvatarId, ...AvatarId[]];

const avatarById = new Map<string, (typeof AVATARS)[number]>(
  AVATARS.map((avatar) => [avatar.id, avatar]),
);
const avatarByUrl = new Map<string, (typeof AVATARS)[number]>(
  AVATARS.map((avatar) => [avatar.url, avatar]),
);

export function getAvatarUrlById(id: AvatarId): string {
  return avatarById.get(id)?.url ?? AVATARS[0].url;
}

export function isValidAvatarId(id: string): id is AvatarId {
  return avatarById.has(id);
}

export function resolveAvatarId(image: string | null | undefined): AvatarId {
  if (image && avatarByUrl.has(image)) {
    return avatarByUrl.get(image)!.id;
  }
  if (image && avatarById.has(image)) {
    return avatarById.get(image)!.id;
  }

  return AVATARS[0].id;
}
