"use client";
import type { MiniGame } from "@nauka/shared";
import { MatchGameView } from "@/components/lesson/games/match";
import { ClozeGameView } from "@/components/lesson/games/cloze";
import { TrueFalseGameView } from "@/components/lesson/games/truefalse";
import { OrderGameView } from "@/components/lesson/games/order";

export function GameView({ game, onDone }: { game: MiniGame; onDone: (correct: number, total: number) => void }) {
  switch (game.type) {
    case "match":
      return <MatchGameView game={game} onDone={onDone} />;
    case "cloze":
      return <ClozeGameView game={game} onDone={onDone} />;
    case "truefalse":
      return <TrueFalseGameView game={game} onDone={onDone} />;
    case "order":
      return <OrderGameView game={game} onDone={onDone} />;
  }
}

export const GAME_LABEL: Record<MiniGame["type"], string> = { match: "Pary", cloze: "Luka", truefalse: "Prawda / fałsz", order: "Kolejność" };
