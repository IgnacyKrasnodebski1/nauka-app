import { chestOpenable, isLevelUnlocked, layoutPath, levelProgress, trophyClaimable, unlockedIndex, type PathNode, type SubjectProgress, type Topic } from "@nauka/shared";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { haptic } from "@/lib/app-state";
import { useReduceMotion } from "@/lib/motion";
import { play } from "@/lib/sfx";
import { COLORS, HARD_EDGE, PLAY, RADIUS, SPACE, UI, display } from "@/lib/theme";
import { useHue } from "./Accent";
import { Chest, Trophy } from "./Chest";
import { Confetti } from "./Confetti";
import { Icon } from "./Icon";
import { Muted } from "./Text";

const NODE = UI.node;
const EDGE = 6;
const STEP_Y = 128;

/** Kawałek ścieżki przez węzły 0..k (ta sama krzywa co w layoutPath). */
function pathThrough(nodes: PathNode[]): string {
  let d = "";
  nodes.forEach((n, k) => {
    if (k === 0) d += `M ${n.x} ${n.y}`;
    else {
      const p = nodes[k - 1]!;
      const c = (n.y - p.y) / 2;
      d += ` C ${p.x} ${p.y + c}, ${n.x} ${n.y - c}, ${n.x} ${n.y}`;
    }
  });
  return d;
}

/**
 * Wijąca się ścieżka (SVG z `layoutPath`): kreskowana hairline + wypełnienie kolorem przedmiotu do aktywnego węzła.
 * Węzły 76 px z krawędzią 3D: zrobione (hue + ✓ + gwiazdki), aktywny (ring + poświata + dymek START),
 * zablokowane (kłódka); skrzynki co 3 poziomy; trofeum na końcu. Auto-scroll do aktywnego węzła.
 */
export function WindingPath({ topic, progress, onOpen, onLocked, onChest, onTrophy, header, footer }: { topic: Topic; progress: SubjectProgress; onOpen: (levelId: string) => void; onLocked: () => void; onChest: (chestIdx: number) => number; onTrophy: () => number; header?: React.ReactNode; footer?: React.ReactNode }) {
  const hue = useHue();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const width = Math.min(screenW, 520) - UI.gutter * 2;
  const layout = useMemo(() => layoutPath(topic.levels.length, { width, stepY: STEP_Y, nodeSize: NODE, padY: NODE / 2 + 40 }), [topic.levels.length, width]);
  const activeIdx = unlockedIndex(topic, progress);
  const activeNode = layout.nodes.find((n) => n.kind === "level" && n.levelIndex === activeIdx) ?? layout.nodes[0];
  const allDone = topic.levels.every((l) => levelProgress(progress, l.id).done);
  const solidD = useMemo(() => {
    if (!activeNode) return "";
    const upTo = allDone ? layout.nodes : layout.nodes.slice(0, activeNode.i + 1);
    return pathThrough(upTo);
  }, [layout, activeNode, allDone]);
  const scroll = useRef<ScrollView>(null);
  const [headerH, setHeaderH] = useState(0);
  const [burst, setBurst] = useState<{ x: number; y: number; n: number } | null>(null);

  useEffect(() => {
    if (!activeNode || allDone) return;
    const y = Math.max(0, headerH + activeNode.y - screenH * 0.42);
    if (y < 80) return;
    const t = setTimeout(() => scroll.current?.scrollTo({ y, animated: true }), 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerH, topic.id]);

  const offsetX = (width - layout.width) / 2;

  return (
    <ScrollView ref={scroll} contentContainerStyle={{ paddingBottom: 80 + insets.bottom }} showsVerticalScrollIndicator={false}>
      {header ? <View onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}>{header}</View> : null}
      <View style={{ width: layout.width, height: layout.height, alignSelf: "center", marginLeft: offsetX }}>
        <Svg width={layout.width} height={layout.height} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Path d={layout.d} stroke={COLORS.lineStrong} strokeWidth={5} strokeDasharray="1 14" strokeLinecap="round" fill="none" />
          {solidD ? <Path d={solidD} stroke={hue.deep} strokeWidth={10} strokeLinecap="round" fill="none" /> : null}
          {solidD ? <Path d={solidD} stroke={hue.color} strokeWidth={6} strokeLinecap="round" fill="none" /> : null}
        </Svg>
        {layout.nodes.map((n) => {
          if (n.kind === "level") {
            const lv = topic.levels[n.levelIndex!]!;
            const lp = levelProgress(progress, lv.id);
            const unlocked = isLevelUnlocked(topic, progress, lv.id);
            const active = unlocked && !lp.done;
            return <LevelNode key={lv.id} x={n.x} y={n.y} title={lv.title} emoji={lv.emoji} index={n.levelIndex!} done={lp.done} stars={lp.stars} active={active} unlocked={unlocked} onPress={unlocked ? () => onOpen(lv.id) : onLocked} />;
          }
          if (n.kind === "chest") {
            const opened = (progress.chests ?? []).includes(n.chestIndex!);
            const openable = !opened && chestOpenable(progress, topic.levels, n.chestIndex!);
            return (
              <View key={`c${n.i}`} style={{ position: "absolute", left: n.x - 32, top: n.y - 32, alignItems: "center" }}>
                <Chest
                  state={opened ? "opened" : openable ? "openable" : "locked"}
                  onPress={() => {
                    const g = onChest(n.chestIndex!);
                    if (g) setBurst({ x: n.x, y: n.y, n: g });
                  }}
                />
                <Muted size="xs" weight={700} color={openable ? PLAY.yellow : COLORS.faint} style={{ marginTop: 6 }}>
                  {opened ? "otwarta" : openable ? "+20 💎" : "skrzynka"}
                </Muted>
              </View>
            );
          }
          const claimed = (progress.chests ?? []).includes(-1);
          const claimable = !claimed && trophyClaimable(progress, topic.levels);
          return (
            <View key="trophy" style={{ position: "absolute", left: n.x - NODE / 2, top: n.y - NODE / 2, alignItems: "center" }}>
              <Trophy
                state={claimed ? "claimed" : claimable ? "claimable" : "locked"}
                onPress={() => {
                  const g = onTrophy();
                  if (g) setBurst({ x: n.x, y: n.y, n: g });
                }}
              />
              <Muted size="xs" weight={700} color={claimable ? PLAY.yellow : COLORS.faint} style={{ marginTop: 6 }}>
                {claimed ? "zdobyte" : claimable ? "+50 💎" : "trofeum"}
              </Muted>
            </View>
          );
        })}
        {burst ? (
          <View style={{ position: "absolute", left: burst.x - 40, top: burst.y - 40, width: 80, height: 80 }} pointerEvents="none">
            <Confetti run count={60} origin={0.5} top={0} color={PLAY.yellow} />
            <GemBurst n={burst.n} onDone={() => setBurst(null)} />
          </View>
        ) : null}
      </View>
      {footer}
    </ScrollView>
  );
}

function GemBurst({ n, onDone }: { n: number; onDone: () => void }) {
  const y = useSharedValue(0);
  const op = useSharedValue(1);
  useEffect(() => {
    y.set(withTiming(-70, { duration: 1100, easing: Easing.out(Easing.cubic) }));
    op.set(withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 400 })));
    const t = setTimeout(onDone, 1500);
    return () => clearTimeout(t);
  }, [y, op, onDone]);
  const st = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ translateY: y.value }] }));
  return (
    <Animated.Text style={[{ position: "absolute", left: 0, right: 0, top: 10, textAlign: "center", fontFamily: display(800), fontSize: 26, color: PLAY.gem }, st]}>
      +{n} 💎
    </Animated.Text>
  );
}

function LevelNode({ x, y, title, emoji, index, done, stars, active, unlocked, onPress }: { x: number; y: number; title: string; emoji: string; index: number; done: boolean; stars: number; active: boolean; unlocked: boolean; onPress: () => void }) {
  const hue = useHue();
  const reduce = useReduceMotion();
  const pressed = useSharedValue(0);
  const face = done || active ? hue.color : COLORS.bg3;
  const deep = done || active ? hue.deep : PLAY.surfaceDeep;
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: pressed.value * EDGE }] }));
  return (
    <View style={{ position: "absolute", left: x - NODE / 2, top: y - NODE / 2, alignItems: "center", width: NODE }}>
      {active ? <Pulse color={hue.color} /> : null}
      {active ? <StartBubble color={hue.deep} /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        onPressIn={() => pressed.set(withTiming(1, { duration: reduce ? 0 : 60 }))}
        onPressOut={() => pressed.set(withTiming(0, { duration: reduce ? 0 : 120 }))}
        onPress={() => {
          haptic.tap();
          play("tap");
          onPress();
        }}
        style={[s.nodeWrap, { backgroundColor: deep }]}
      >
        <Animated.View style={[s.node, { backgroundColor: face }, active && { borderWidth: 4, borderColor: "#fff" }, !unlocked && { borderWidth: 1, borderColor: COLORS.line }, anim]}>
          {done ? <Icon name="checkmark" size={36} color="#fff" /> : active ? <Text style={s.emoji}>{emoji || "★"}</Text> : <Icon name="lock-closed" size={26} color={COLORS.faint} />}
        </Animated.View>
      </Pressable>
      {done ? (
        <View style={s.stars}>
          {[0, 1, 2].map((i) => (
            <Icon key={i} name="star" size={13} color={i < stars ? PLAY.yellow : COLORS.faint} />
          ))}
        </View>
      ) : null}
      <Muted size="xs" weight={700} center numberOfLines={2} color={unlocked ? COLORS.textSoft : COLORS.faint} style={[s.title, done && { marginTop: 2 }]}>
        {index + 1}. {title}
      </Muted>
    </View>
  );
}

/** Pulsująca poświata aktywnego węzła. */
function Pulse({ color }: { color: string }) {
  const reduce = useReduceMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    v.set(withRepeat(withSequence(withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 1100, easing: Easing.in(Easing.quad) })), -1, false));
  }, [v, reduce]);
  const st = useAnimatedStyle(() => ({ opacity: 0.16 + v.value * 0.24, transform: [{ scale: 1.15 + v.value * 0.3 }] }));
  return <Animated.View pointerEvents="none" style={[s.pulse, { backgroundColor: color }, st]} />;
}

/** Dymek „START” skaczący nad aktywnym węzłem. */
function StartBubble({ color }: { color: string }) {
  const reduce = useReduceMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    v.set(withRepeat(withSequence(withTiming(-6, { duration: 600, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 600, easing: Easing.inOut(Easing.quad) })), -1, false));
  }, [v, reduce]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: v.value }] }));
  return (
    <Animated.View pointerEvents="none" style={[s.bubble, st]}>
      <View style={s.bubbleBox}>
        <Text style={[s.bubbleTxt, { color }]}>START</Text>
      </View>
      <View style={s.bubbleTail} />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  nodeWrap: { width: NODE, height: NODE + EDGE, borderRadius: NODE / 2 },
  node: { width: NODE, height: NODE, borderRadius: NODE / 2, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 30 },
  stars: { flexDirection: "row", gap: 1, marginTop: 4 },
  title: { width: 150, marginTop: 6, fontSize: 11, lineHeight: 14 },
  pulse: { position: "absolute", top: 0, width: NODE, height: NODE, borderRadius: NODE / 2 },
  bubble: { position: "absolute", top: -44, alignItems: "center", zIndex: 5 },
  bubbleBox: { backgroundColor: "#fff", borderRadius: RADIUS.sm, paddingVertical: 6, paddingHorizontal: 12, borderBottomWidth: HARD_EDGE, borderBottomColor: "#C9CCDA" },
  bubbleTxt: { fontFamily: display(800), fontSize: 13, letterSpacing: 1 },
  bubbleTail: { width: 12, height: 12, backgroundColor: "#fff", transform: [{ rotate: "45deg" }], marginTop: -8 },
  _sp: { padding: SPACE[1] },
});
