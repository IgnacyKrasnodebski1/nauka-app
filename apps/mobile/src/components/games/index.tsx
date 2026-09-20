import type { MiniGame } from "@nauka/shared";
import React from "react";
import { ClozeGame } from "./ClozeGame";
import { MatchGame } from "./MatchGame";
import { OrderGame } from "./OrderGame";
import { TrueFalseGame } from "./TrueFalseGame";

/** Renderuje dowolną mini-grę z kontraktu shared. */
export function MiniGameView({ game, onDone, onAnswer }: { game: MiniGame; onDone: (correct: number, total: number) => void; onAnswer?: (correct: boolean) => void }) {
  switch (game.type) {
    case "match":
      return <MatchGame game={game} onDone={onDone} onAnswer={onAnswer} />;
    case "cloze":
      return <ClozeGame game={game} onDone={onDone} onAnswer={onAnswer} />;
    case "truefalse":
      return <TrueFalseGame game={game} onDone={onDone} onAnswer={onAnswer} />;
    case "order":
      return <OrderGame game={game} onDone={onDone} onAnswer={onAnswer} />;
  }
}
