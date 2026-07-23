export type RoomSummary = {
  id: string;
  slug: string;
  name: string;
  description: string;
  prezzoTotale: string;
  prezzoCaparra: string;
  durationMinutes: number;
  minPlayers: number;
  maxPlayers: number;
  terrorLevel: number;
  isActive: boolean;
  /** Cover già ottimizzata (API media) o fallback /public. */
  imageUrl: string | null;
};
