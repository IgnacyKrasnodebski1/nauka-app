"use client";
import type { ReactNode } from "react";
import type { MiniGame } from "@nauka/shared";
import { MatchGameView } from "@/components/lesson/games/match";
import { ClozeGameView } from "@/components/lesson/games/cloze";
import { TrueFalseGameView } from "@/components/lesson/games/truefalse";
import { OrderGameView } from "@/components/lesson/games/order";

/**
 * Report one answer to the lesson. `text` = explanation for the feedback sheet (null = no sheet, advance at once).
 * The lesson updates combo/XP/hearts, shows the sheet and calls `next()` when the player taps DALEJ.
 */
export type AnswerFn = (correct: boolean, text: ReactNode | null, next: () => void) => void;

export interface GameProps<G extends MiniGame = MiniGame> {
  game: G;
  onAnswer: AnswerFn;
  onDone: (correct: number, total: number) => void;
}

export function GameView({ game, onAnswer, onDone }: GameProps) {
  switch (game.type) {
    case "match":
      return <MatchGameView game={game} onAnswer={onAnswer} onDone={onDone} />;
    case "cloze":
      return <ClozeGameView game={game} onAnswer={onAnswer} onDone={onDone} />;
    case "truefalse":
      return <TrueFalseGameView game={game} onAnswer={onAnswer} onDone={onDone} />;
    case "order":
      return <OrderGameView game={game} onAnswer={onAnswer} onDone={onDone} />;
  }
}

export const GAME_LABEL: Record<MiniGame["type"], string> = { match: "Pary", cloze: "Luka", truefalse: "Prawda / fałsz", order: "Kolejność" };
