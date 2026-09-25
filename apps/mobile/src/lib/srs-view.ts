import { allFlashcards, isDue, type SrsCard } from "@nauka/shared";
import type { AppState } from "./app-state";
import { noEmoji } from "./format";

export interface SrsEntry {
  topicId: string;
  levelId: string;
  index: number;
  /** klucz karty SRS: `${levelId}:${index}` (shared cardKey) */
  key: string;
  card: SrsCard;
  term: string;
  def: string;
  lvl: string;
}

/** Wpisy SRS (wszystkie + do powtórki dziś), opcjonalnie tylko z jednego przedmiotu; do powtórki najstarsze terminy pierwsze. */
export function dueEntries(app: Pick<AppState, "topics" | "srs">, subjectId?: string): { due: SrsEntry[]; all: SrsEntry[] } {
  const now = new Date();
  const due: SrsEntry[] = [];
  const all: SrsEntry[] = [];
  for (const t of app.topics) {
    if (subjectId && t.subjectId !== subjectId) continue;
    const st = app.srs[t.id] ?? {};
    for (const c of allFlashcards(t)) {
      const key = `${c.levelId}:${c.index}`;
      const card = st[key];
      if (!card) continue;
      const e: SrsEntry = { topicId: t.id, levelId: c.levelId, index: c.index, key, card, term: c.t, def: c.d, lvl: noEmoji(c.lvl) };
      all.push(e);
      if (isDue(card, now)) due.push(e);
    }
  }
  due.sort((a, b) => (a.card.due < b.card.due ? -1 : a.card.due > b.card.due ? 1 : 0));
  return { due, all };
}
