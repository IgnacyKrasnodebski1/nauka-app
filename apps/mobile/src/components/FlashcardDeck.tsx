import type { SrsGrade } from "@nauka/shared";
import React, { useRef, useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { PLAY, SPACE } from "@/lib/theme";
import { Button3D } from "./Button3D";
import { Flashcard } from "./Flashcard";
import { Icon } from "./Icon";
import { SwipeDeck, type SwipeDeckHandle, type SwipeDir } from "./SwipeDeck";
import { Muted } from "./Text";

export interface DeckCard {
  key: string;
  t: string;
  d: string;
  tag?: string;
}

const GRADE_OF: Record<SwipeDir, SrsGrade> = { left: 0, right: 2, up: 3 };

/**
 * Stos fiszek: swipe prawo = umiem (2), lewo = jeszcze nie (0), góra = łatwe (3); tap = flip.
 * Pod stosem trzy przyciski 3D (te same akcje) + „Trudne” (1) jako ghost.
 */
export function FlashcardDeck({ cards, index, onGrade, style }: { cards: DeckCard[]; index: number; onGrade: (g: SrsGrade, card: DeckCard, i: number) => void; style?: StyleProp<ViewStyle> }) {
  const deck = useRef<SwipeDeckHandle>(null);
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const card = cards[index];
  const grade = (dir: SwipeDir, c: DeckCard, i: number) => {
    onGrade(GRADE_OF[dir], c, i);
  };
  return (
    <View style={[{ flex: 1 }, style]}>
      <SwipeDeck
        ref={deck}
        items={cards}
        index={index}
        keyOf={(c) => c.key}
        labels={{ left: "Jeszcze nie", right: "Umiem", up: "Łatwe" }}
        icons={{ left: "refresh", right: "checkmark", up: "flash" }}
        onSwipe={grade}
        renderCard={(c, _i, top) => <Flashcard term={c.t} def={c.d} tag={c.tag} flipped={top ? !!flipped[c.key] : false} onFlip={() => top && setFlipped((f) => ({ ...f, [c.key]: !f[c.key] }))} />}
      />
      <View style={s.hint}>
        <Icon name="arrow-back" size={12} color={PLAY.red} />
        <Muted size="xs" weight={700}>
          jeszcze nie · umiem
        </Muted>
        <Icon name="arrow-forward" size={12} color={PLAY.green} />
        <Muted size="xs" weight={700}>
          · góra = łatwe
        </Muted>
        <Icon name="arrow-up" size={12} color={PLAY.blue} />
      </View>
      <View style={s.row}>
        <Button3D label="Nie" variant="red" onPress={() => deck.current?.swipe("left")} style={{ flex: 1 }} left={<Icon name="refresh" size={16} color="#fff" />} disabled={!card} />
        <Button3D
          label="Trudne"
          variant="orange"
          onPress={() => {
            if (card) onGrade(1, card, index);
          }}
          style={{ flex: 1 }}
          disabled={!card}
        />
        <Button3D label="Umiem" variant="green" onPress={() => deck.current?.swipe("right")} style={{ flex: 1 }} left={<Icon name="checkmark" size={16} color="#fff" />} disabled={!card} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  hint: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: SPACE[3] },
  row: { flexDirection: "row", gap: SPACE[2], marginTop: SPACE[3] },
});
