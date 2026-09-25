import { bossNodeState, chestIndexes, chestOpenable, levelProgress, type SubjectProgress, type Topic } from "@nauka/shared";
import React, { useEffect, useMemo, useRef } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { noEmoji } from "@/lib/format";
import { T, TONES, UI } from "@/lib/theme";
import { useAccent } from "./Accent";
import { BossSvg } from "./BossSvg";
import { Icon, StarRow } from "./Icon";
import { Motion } from "./Motion";
import { Body, Eyebrow } from "./Text";
import { Blob, Card, Press, Touch } from "./ui";

/** Poziome przesunięcia kolejnych węzłów (Path.html: −110, 10, 96, −30, −116 …), cyklicznie. */
const OFF = [-110, 10, 96, -30];
type Item = { kind: "level"; i: number } | { kind: "chest"; after: number } | { kind: "boss" };

/**
 * Ścieżka (Path.html): karta rozdziału, wężyk węzłów 74 px (bieżący 88 px z dymkiem „ZACZNIJ”), łączniki, skrzynia
 * po co trzecim poziomie, boss jako ostatni węzeł. Odblokowania z shared (`unlockedIndex`, `chestOpenable`, `bossNodeState`).
 */
export function PathView({ topic, progress, onLevel, onChest, onBoss, hidden }: { topic: Topic; progress: SubjectProgress; onLevel: (levelId: string, unlocked: boolean, done: boolean) => void; onChest: (after: number, openable: boolean, opened: boolean) => void; onBoss: (state: "locked" | "open" | "beaten") => void; hidden?: (levelId: string) => boolean }) {
  const acc = useAccent();
  const levels = topic.levels.filter((l) => !hidden?.(l.id));
  const items = useMemo(() => {
    const out: Item[] = [];
    const chests = new Set(chestIndexes(levels.length));
    levels.forEach((_, i) => {
      out.push({ kind: "level", i });
      if (chests.has(i)) out.push({ kind: "chest", after: i });
    });
    out.push({ kind: "boss" });
    return out;
  }, [levels]);
  const isDone = (i: number) => levelProgress(progress, levels[i]!.id).done;
  const unlocked = (i: number) => i === 0 || isDone(i - 1);
  const curIdx = levels.findIndex((_, i) => unlocked(i) && !isDone(i));
  const all = curIdx < 0;
  const boss = bossNodeState({ levels }, progress);
  const opened = new Set(progress.chests ?? []);
  const scroll = useRef<ScrollView>(null);
  const curY = useRef(0);
  useEffect(() => {
    const t = setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, curY.current - 260), animated: true }), 250);
    return () => clearTimeout(t);
  }, [curIdx]);
  const doneOf = (it: Item) => (it.kind === "chest" ? opened.has(it.after) : it.kind === "boss" ? boss === "beaten" : isDone(it.i));

  return (
    <ScrollView ref={scroll} contentContainerStyle={s.wrap} showsVerticalScrollIndicator={false}>
      <Blob tone="mid" size={300} top={140} center />
      <Motion kind="up">
        <Card tone="accent" padding={0} radius={16} style={{ marginBottom: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 14 }}>
            <View style={{ width: 6, height: 26, borderRadius: 3, backgroundColor: acc.color }} />
            <View style={{ flex: 1 }}>
              <Eyebrow size={10.5} color={acc.sub}>
                Rozdział {all ? levels.length : curIdx + 1}
              </Eyebrow>
              <Body size={14} weight={800}>
                {all ? (boss === "beaten" ? "Wszystko zaliczone" : "Boss rozdziału czeka") : noEmoji(levels[curIdx]!.title)}
              </Body>
            </View>
            <Icon name={all && boss !== "beaten" ? "boss" : "list"} size={18} color={acc.sub} />
          </View>
        </Card>
      </Motion>
      <View style={[s.conn, { backgroundColor: acc.color, marginTop: 8 }]} />
      {items.map((it, k) => {
        const x = OFF[k % OFF.length]!;
        const prevX = k > 0 ? OFF[(k - 1) % OFF.length]! : 0;
        const conn = k > 0 ? <View key={`c${k}`} style={[s.conn, { backgroundColor: doneOf(items[k - 1]!) ? acc.color : T.line, marginLeft: (prevX + x) / 2 }]} /> : null;
        let node: React.ReactNode;
        let label: React.ReactNode;
        let cur = false;
        if (it.kind === "chest") {
          const isOpen = opened.has(it.after);
          const can = chestOpenable(progress, levels, it.after);
          node = (
            <Motion kind={can && !isOpen ? "sway" : "none"}>
              <Press onPress={() => onChest(it.after, can, isOpen)} drop={6} edge={T.shadow} radius={18} faceStyle={[s.node, { borderRadius: 18, backgroundColor: T.surface, borderWidth: 2, borderColor: isOpen ? T.line : "#4A3F12" }]} accessibilityLabel={"Skrzynia: " + (isOpen ? "otwarta" : can ? "do otwarcia" : `po zaliczeniu poziomu ${it.after + 1}`)}>
                <Icon name="chest" size={32} stroke={2.4} color={isOpen ? T.muted3 : T.gold} />
              </Press>
            </Motion>
          );
          label = (
            <Body size={12} weight={800} color={isOpen ? T.muted3 : T.gold}>
              {isOpen ? "Otwarta" : "Skrzynia"}
            </Body>
          );
        } else if (it.kind === "boss") {
          const open = boss === "open",
            beaten = boss === "beaten";
          cur = open;
          node = (
            <Motion kind={open ? "pulse" : "none"}>
              <Press onPress={() => onBoss(boss)} drop={open ? 7 : 6} edge={open ? TONES.violet.dark : T.shadow} radius={open ? 44 : 37} faceStyle={[s.node, open ? { width: UI.nodeCurrent, height: UI.nodeCurrent, borderRadius: 44, backgroundColor: T.violet } : beaten ? { backgroundColor: TONES.violet.tint, borderWidth: 2, borderColor: T.violet } : { backgroundColor: T.surface, borderWidth: 2, borderColor: T.line }]} accessibilityLabel={"Boss rozdziału: " + (beaten ? "pokonany, powtórz walkę" : open ? "zacznij walkę" : "po zaliczeniu wszystkich poziomów")}>
                <BossSvg size={open ? 56 : 48} color={open ? T.onViolet : beaten ? T.violet : T.muted3} muted={!open && !beaten} />
                {beaten ? (
                  <View style={s.won}>
                    <Icon name="check" size={13} stroke={4} color={T.onAcid} />
                  </View>
                ) : null}
              </Press>
            </Motion>
          );
          label = (
            <Body size={12} weight={800} color={beaten ? T.txt : open ? T.violet : "#5C568F"}>
              {beaten ? "Boss pokonany" : "Boss rozdziału"}
            </Body>
          );
        } else {
          const lv = levels[it.i]!;
          const un = unlocked(it.i),
            dn = isDone(it.i);
          const stars = levelProgress(progress, lv.id).stars;
          cur = un && !dn;
          node = (
            <Motion kind={cur ? "pulse" : "none"}>
              <Press onPress={() => onLevel(lv.id, un, dn)} drop={cur ? 7 : 6} edge={un ? acc.dark : T.shadow} radius={cur ? 44 : 37} faceStyle={[s.node, cur ? { width: UI.nodeCurrent, height: UI.nodeCurrent, borderRadius: 44, backgroundColor: acc.color } : dn ? { backgroundColor: acc.color } : { backgroundColor: T.surface, borderWidth: 2, borderColor: T.line }]} accessibilityLabel={(dn ? "Powtórz: " : cur ? "Zacznij: " : "Zablokowane: ") + noEmoji(lv.title)}>
                {dn ? <Icon name="check" size={34} stroke={3.4} color={acc.on} /> : cur ? <Icon name="bolt" size={40} color={acc.on} /> : <Icon name="lock" size={28} color={T.muted2} />}
                {dn ? (
                  <View style={s.stars}>
                    <StarRow n={stars} size={12} />
                  </View>
                ) : null}
              </Press>
            </Motion>
          );
          label = (
            <Body size={cur ? 12.5 : 12} weight={800} color={cur ? acc.color : dn ? T.txt : "#5C568F"} center>
              {noEmoji(lv.title)}
            </Body>
          );
        }
        return (
          <React.Fragment key={k}>
            {conn}
            <View style={[s.nodeWrap, { marginLeft: x }]} onLayout={cur ? (e) => (curY.current = e.nativeEvent.layout.y) : undefined}>
              {cur ? (
                <>
                  <Motion kind="bob" style={s.bubble}>
                    <View style={[s.bubbleBox, { backgroundColor: it.kind === "boss" ? T.violet : acc.color, shadowColor: it.kind === "boss" ? TONES.violet.dark : acc.dark }]}>
                      <Body size={12} weight={800} color={it.kind === "boss" ? T.onViolet : acc.on} ls={1}>
                        {it.kind === "boss" ? "WALKA" : "ZACZNIJ"}
                      </Body>
                    </View>
                    <View style={[s.tri, { borderTopColor: it.kind === "boss" ? T.violet : acc.color }]} />
                  </Motion>
                  <View style={{ height: 14 }} />
                </>
              ) : null}
              {node}
              <View style={{ marginTop: 12, maxWidth: 140 }}>{label}</View>
            </View>
          </React.Fragment>
        );
      })}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

/** Mały przycisk-łącznik w kolorze (dla Ćwiczeń itp.). */
export function PathLink({ children, onPress }: { children: React.ReactNode; onPress: () => void }) {
  return (
    <Touch onPress={onPress} style={{ alignItems: "center" }}>
      {children}
    </Touch>
  );
}

const s = StyleSheet.create({
  wrap: { paddingTop: 14, paddingHorizontal: 18, paddingBottom: 60, alignItems: "center", gap: 6 },
  conn: { width: 5, height: 16, borderRadius: 3 },
  nodeWrap: { alignItems: "center", position: "relative" },
  node: { width: UI.node, height: UI.node, borderRadius: 37, alignItems: "center", justifyContent: "center" },
  stars: { position: "absolute", bottom: -4, flexDirection: "row", backgroundColor: T.bg, borderRadius: 999, paddingHorizontal: 5, paddingVertical: 2 },
  won: { position: "absolute", right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: T.acid, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: T.bg },
  bubble: { alignItems: "center" },
  bubbleBox: { width: 108, paddingVertical: 7, borderRadius: 12, alignItems: "center", shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 4 } },
  tri: { width: 0, height: 0, borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 9, borderLeftColor: "transparent", borderRightColor: "transparent" },
});
