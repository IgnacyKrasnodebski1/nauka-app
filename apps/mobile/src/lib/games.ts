import { shuffle, type Flashcard, type Level, type MatchGame, type MiniGame } from "@nauka/shared";

export { shuffle };

export const KEYS_ABC = ["A", "B", "C", "D", "E"] as const;

/** Skraca definicję do „prawej strony” pary (żeby kafelki match nie były elaboratem). */
function shortDef(d: string): string {
  const t = d.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  return t.length > 70 ? t.slice(0, 67).trimEnd() + "…" : t;
}

/** Mini-gra „dopasuj pary” z fiszek poziomu — fallback dla treści bez `games` (np. seedy z legacy). */
export function matchFromFlashcards(cards: Flashcard[], n = 5): MatchGame | null {
  const usable = cards.filter((c) => c.t.trim() && c.d.trim());
  if (usable.length < 3) return null;
  const pick = shuffle(usable).slice(0, Math.min(n, usable.length));
  return { type: "match", title: "Dopasuj pary 🧩", pairs: pick.map((c) => ({ l: c.t, r: shortDef(c.d) })) };
}

/** Gry do lekcji: z danych, a gdy brak — jedna gra z fiszek. */
export function gamesForLevel(level: Level): MiniGame[] {
  if (level.games && level.games.length) return level.games;
  const m = matchFromFlashcards(level.flashcards);
  return m ? [m] : [];
}

/** Ile „poprawnych” daje gra — do XP/podsumowania. */
export function gameSize(g: MiniGame): number {
  switch (g.type) {
    case "match":
      return g.pairs.length;
    case "cloze":
      return g.items.length;
    case "truefalse":
      return g.items.length;
    case "order":
      return g.steps.length;
  }
}

export function gameLabel(g: MiniGame): string {
  if (g.title) return g.title;
  switch (g.type) {
    case "match":
      return "Dopasuj pary 🧩";
    case "cloze":
      return "Uzupełnij lukę ✍️";
    case "truefalse":
      return "Prawda czy fałsz? ⚖️";
    case "order":
      return "Ułóż w kolejności 🔢";
  }
}
