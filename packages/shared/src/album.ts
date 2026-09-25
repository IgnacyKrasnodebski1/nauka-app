/**
 * Album of concepts (design/DESIGN.md §3 "Album", §4.5; legacy engine.js KROK 8 albumCheck).
 * A flashcard enters the album once its SRS box is ≥ 3 (interval ≥ 7 days). Rarity: epic = its level was passed with
 * 3 stars, rare = collected without a single lapse, common = the rest. Keys: `<topicId>:<levelId>:<cardIndex>`.
 */
import type { AlbumEntry, AlbumMap, AlbumRarity, LevelProgress, TopicContent } from "./types.js";
import type { SrsCard } from "./srs.js";
import { allFlashcards } from "./finalize.js";

/** Box a card enters the album at (legacy `e.box >= 3`). */
export const ALBUM_MIN_BOX = 3;
/** Leitner-style box intervals in days (design/DESIGN.md §4.4): box 0 → 1 → 3 → 7 → 21. */
export const SRS_BOX_DAYS = [0, 1, 3, 7, 21] as const;

export const ALBUM_RARITY_LABEL: Record<AlbumRarity, string> = { common: "zwykłe", rare: "trudne", epic: "mistrzowskie" };
export const ALBUM_RARITY_TONE: Record<AlbumRarity, "acid" | "cyan" | "violet"> = { common: "acid", rare: "cyan", epic: "violet" };

/** Map the SM-2 card (srs.ts) onto a 0..4 box by its interval, so the album rule matches the legacy Leitner boxes. */
export function srsBox(card: Pick<SrsCard, "interval">): 0 | 1 | 2 | 3 | 4 {
  const d = card.interval;
  if (d >= SRS_BOX_DAYS[4]) return 4;
  if (d >= SRS_BOX_DAYS[3]) return 3;
  if (d >= SRS_BOX_DAYS[2]) return 2;
  if (d >= SRS_BOX_DAYS[1]) return 1;
  return 0;
}

export function albumKey(topicId: string, levelId: string, cardIndex: number): string {
  return `${topicId}:${levelId}:${cardIndex}`;
}

/** Rarity for a card that qualifies, or null when the box is still too low. */
export function albumRarity(card: Pick<SrsCard, "interval" | "lapses"> | { box: number; lapses: number }, level?: Pick<LevelProgress, "done" | "stars"> | null): AlbumRarity | null {
  const box = "box" in card ? card.box : srsBox(card);
  if (box < ALBUM_MIN_BOX) return null;
  if (level?.done && (level.stars | 0) >= 3) return "epic";
  if ((card.lapses | 0) === 0) return "rare";
  return "common";
}

/**
 * After an SRS review: add the card to the album when it qualifies. Idempotent — returns the same map when nothing
 * changed. `added` carries the new entry for the toast ("Do albumu: <term>").
 */
export function albumCheck(album: AlbumMap, key: string, card: Pick<SrsCard, "interval" | "lapses">, level: Pick<LevelProgress, "done" | "stars"> | null | undefined, today: string): { album: AlbumMap; added: (AlbumEntry & { key: string }) | null } {
  if (album[key]) return { album, added: null };
  const rarity = albumRarity(card, level);
  if (!rarity) return { album, added: null };
  const entry: AlbumEntry = { rarity, at: today };
  return { album: { ...album, [key]: entry }, added: { ...entry, key } };
}

/** "N z M zebrane" for one topic or all. */
export function albumCount(album: AlbumMap, topics: (Pick<TopicContent, "levels"> & { id: string })[]): { n: number; m: number } {
  let n = 0, m = 0;
  for (const t of topics) {
    for (const c of allFlashcards(t)) {
      m++;
      if (album[albumKey(t.id, c.levelId, c.index)]) n++;
    }
  }
  return { n, m };
}

export interface AlbumTile {
  key: string;
  topicId: string;
  levelId: string;
  index: number;
  term: string;
  def: string;
  entry: AlbumEntry | null;
  /** collected today */
  fresh: boolean;
}

/** Grid for the Album screen: collected first (newest first), then locked silhouettes. */
export function albumTiles(album: AlbumMap, topics: (Pick<TopicContent, "levels"> & { id: string })[], today: string, topicId?: string): AlbumTile[] {
  const tiles: AlbumTile[] = [];
  for (const t of topics) {
    if (topicId && t.id !== topicId) continue;
    for (const c of allFlashcards(t)) {
      const key = albumKey(t.id, c.levelId, c.index);
      const entry = album[key] ?? null;
      tiles.push({ key, topicId: t.id, levelId: c.levelId, index: c.index, term: c.t, def: c.d, entry, fresh: !!entry && entry.at === today });
    }
  }
  return tiles.sort((a, b) => {
    if (!!a.entry !== !!b.entry) return a.entry ? -1 : 1;
    if (a.entry && b.entry && a.entry.at !== b.entry.at) return a.entry.at < b.entry.at ? 1 : -1;
    return 0;
  });
}
