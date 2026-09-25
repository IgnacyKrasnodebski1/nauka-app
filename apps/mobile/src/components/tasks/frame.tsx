import { TASK_META, type Task } from "@nauka/shared";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { Icon } from "@/components/Icon";
import { Motion } from "@/components/Motion";
import { SessionChips } from "@/components/QuizBlock";
import type { Feedback } from "@/components/Sheets";
import { Body, Display, Eyebrow } from "@/components/Text";
import { Press, Tag, Touch } from "@/components/ui";
import { haptic } from "@/lib/haptic";
import { useReduceMotion } from "@/lib/motion";
import { play } from "@/lib/sfx";
import { T, TONES, type Tone } from "@/lib/theme";

/** API zadania (legacy `taskBlock` api): zakończ z wynikiem i wyjaśnieniem; podpowiedź kosztuje XP. */
export interface TaskApi {
  finish(ok: boolean, fb?: Feedback): void;
  hintXp?(n: number): void;
}
export interface TaskProps<TT extends Task = Task> {
  task: TT;
  api: TaskApi;
}
export interface FrameMeta {
  n: number;
  total: number;
  combo?: number;
  broken?: boolean;
  boost?: boolean;
  tag?: string;
  type: Task["type"];
}
const MetaCtx = createContext<FrameMeta>({ n: 1, total: 0, type: "tf" });
export const FrameMetaProvider = MetaCtx.Provider;
export const useFrameMeta = () => useContext(MetaCtx);

/** Ramka zadania: chipy (typ + sesja) → tytuł → treść (przewijana) → stopka (przyciski). */
export function TaskFrame({ children, foot, title, sub, chips, head, style, scroll = true }: { children: React.ReactNode; foot?: React.ReactNode; title?: string; sub?: string; chips?: React.ReactNode; head?: React.ReactNode; style?: StyleProp<ViewStyle>; scroll?: boolean }) {
  const m = useFrameMeta();
  const meta = TASK_META[m.type];
  const top = (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <Tag label={meta.label} tone={meta.tone as Tone} />
        <SessionChips n={m.n} total={m.total} combo={m.combo} broken={m.broken} boost={m.boost} tag={m.tag} word="Zadanie" />
        {chips}
      </View>
      {head}
      {title ? (
        <Motion kind="up">
          <Display size={24} ls={-0.8} lh={28}>
            {title}
          </Display>
          {sub ? (
            <Body size={13} weight={600} color={T.muted} style={{ marginTop: 5 }}>
              {sub}
            </Body>
          ) : null}
        </Motion>
      ) : null}
    </View>
  );
  return (
    <View style={[{ flex: 1 }, style]}>
      {scroll ? (
        <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {top}
          {children}
        </ScrollView>
      ) : (
        <View style={[s.body, { flex: 1 }]}>
          {top}
          {children}
        </View>
      )}
      {foot ? <View style={s.foot}>{foot}</View> : null}
    </View>
  );
}

/** Kafelek słowa (`.wordtile`): surface + linia + krawędź 4; `sel` = fiolet + bob; `used` = kreskowany, wyszarzony. */
export function WordTile({ text, onPress, sel, used, d, onDrop, dragEnabled = true, style }: { text: string; onPress?: () => void; sel?: boolean; used?: boolean; d?: number; onDrop?: (x: number, y: number) => boolean; dragEnabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  const tx = useSharedValue(0),
    ty = useSharedValue(0),
    dragging = useSharedValue(0);
  const ref = useRef<View>(null);
  const origin = useRef({ x: 0, y: 0 });
  const measure = () => ref.current?.measureInWindow((x, y) => (origin.current = { x, y }));
  const end = (dx: number, dy: number) => {
    const ok = onDrop ? onDrop(origin.current.x + dx, origin.current.y + dy) : false;
    if (!ok) {
      tx.set(withSpring(0));
      ty.set(withSpring(0));
    } else {
      tx.set(0);
      ty.set(0);
    }
  };
  const pan = Gesture.Pan()
    .enabled(!!onDrop && !used && dragEnabled)
    .minDistance(8)
    // eslint-disable-next-line react-hooks/refs -- callbacki gestu wykonują się przy zdarzeniu, nie w renderze
    .onBegin(() => runOnJS(measure)())
    .onStart(() => {
      dragging.set(1);
    })
    .onUpdate((e) => {
      tx.set(e.translationX);
      ty.set(e.translationY);
    })
    // eslint-disable-next-line react-hooks/refs -- jw.
    .onEnd((e) => {
      dragging.set(0);
      runOnJS(end)(e.translationX, e.translationY);
    })
    .onFinalize(() => {
      dragging.set(0);
    });
  const st = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: dragging.value ? 1.05 : 1 }], zIndex: dragging.value ? 50 : 1, elevation: dragging.value ? 8 : 0 }));
  const face: ViewStyle = used ? { backgroundColor: T.surface2, borderColor: T.line, borderStyle: "dashed" } : sel ? { backgroundColor: T.violet, borderColor: T.violet } : { backgroundColor: T.surface, borderColor: T.line };
  const inner = (
    <Press onPress={onPress} disabled={used || !onPress} drop={used ? 0 : sel ? 8 : 4} edge={sel ? "#12081C" : T.shadow} radius={16} faceStyle={[s.tile, face]} accessibilityLabel={text} silent>
      <Body size={14.5} weight={800} color={used ? "#3A3560" : sel ? T.onViolet : T.txt}>
        {text}
      </Body>
    </Press>
  );
  const wrapped = sel && !reduce ? <Motion kind="bob">{inner}</Motion> : d != null && !used ? <Motion kind="up" d={d}>{inner}</Motion> : inner;
  return (
    <GestureDetector gesture={pan}>
      <Animated.View ref={ref} style={[st, style]} collapsable={false}>
        {wrapped}
      </Animated.View>
    </GestureDetector>
  );
}

/** Rejestr stref upuszczania: strefa mierzy się w oknie, `zoneAt(x,y)` zwraca jej id. */
export function useDropZones() {
  const zones = useRef<Map<string, { x: number; y: number; w: number; h: number }>>(new Map());
  const register = (id: string, view: View | null) => {
    if (!view) return;
    view.measureInWindow((x, y, w, h) => zones.current.set(id, { x, y, w, h }));
  };
  const zoneAt = (x: number, y: number): string | null => {
    for (const [id, r] of zones.current) if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return id;
    return null;
  };
  return { register, zoneAt };
}

/** Strefa upuszczania (`.tlslot.empty`, `.bucket .bdrop`, `.chslot`): kreskowana ramka; `cur` = fiolet + blink; `hot` = podczas przeciągania. */
export function DropSlot({ id, register, cur, label, onPress, height = 48, style, children }: { id: string; register: (id: string, v: View | null) => void; cur?: boolean; label?: string; onPress?: () => void; height?: number; style?: StyleProp<ViewStyle>; children?: React.ReactNode }) {
  const [tick, setTick] = useState(0);
  const ref = useRef<View>(null);
  useEffect(() => {
    const t = setTimeout(() => register(id, ref.current), 50);
    return () => clearTimeout(t);
  }, [id, register, tick]);
  const inner = (
    <View ref={ref} collapsable={false} onLayout={() => setTick((n) => n + 1)} style={[s.slot, { minHeight: height }, cur ? { borderColor: T.violet, backgroundColor: TONES.violet.tint } : { borderColor: "#332E5C", backgroundColor: T.surface2 }, style]}>
      {children ??
        (label ? (
          <Body size={12.5} weight={800} color={cur ? TONES.violet.txt : T.muted3}>
            {label}
          </Body>
        ) : null)}
    </View>
  );
  const node = cur ? <Motion kind="blink">{inner}</Motion> : inner;
  return onPress ? (
    <Touch onPress={onPress} accessibilityRole="button" accessibilityLabel={label ?? "Miejsce"}>
      {node}
    </Touch>
  ) : (
    node
  );
}

/** Wypełniony slot (przypięty kafelek, `.tlev`/`.chstep.filled`): limonkowy z checkiem; po sprawdzeniu ok/bad. */
export function FilledSlot({ text, onPress, state, style }: { text: string; onPress?: () => void; state?: "ok" | "bad"; style?: StyleProp<ViewStyle> }) {
  const tone = state === "bad" ? TONES.red : TONES.acid;
  const inner = (
    <View style={[s.filled, { backgroundColor: tone.tint, borderColor: tone.tintLine }, style]}>
      <Icon name={state === "bad" ? "close" : "check"} size={16} stroke={3.4} color={tone.color} />
      <Body size={13.5} weight={800} color={tone.txt} style={{ flex: 1 }}>
        {text}
      </Body>
    </View>
  );
  const anim = state === "bad" ? <Motion kind="shake">{inner}</Motion> : <Motion kind="pop">{inner}</Motion>;
  return onPress && !state ? (
    <Touch onPress={onPress} accessibilityRole="button" accessibilityLabel={`${text}, dotknij, żeby cofnąć`}>
      {anim}
    </Touch>
  ) : (
    anim
  );
}

/** Wybór jednej opcji + SPRAWDŹ (thesis, scenario, chart): `chooser`. Zwraca {sel, done, select, check, stateOf}. */
export function useChooser(c: number, api: TaskApi, fb: (sel: number, ok: boolean) => Feedback) {
  const [sel, setSel] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const select = (i: number) => {
    if (done) return;
    setSel(i);
  };
  const check = () => {
    if (done || sel == null) return;
    setDone(true);
    const ok = sel === c;
    if (ok) {
      play("correct");
      haptic.ok();
    } else {
      play("wrong");
      haptic.bad();
    }
    api.finish(ok, fb(sel, ok));
  };
  const stateOf = (i: number): "idle" | "sel" | "correct" | "wrong" | "dim" => (!done ? (sel === i ? "sel" : "idle") : i === c ? "correct" : i === sel ? "wrong" : "dim");
  return { sel, done, select, check, stateOf };
}

/** Pole „Do wyboru”/„Zostało N” nad pulą. */
export function PoolLabel({ text }: { text: string }) {
  return <Eyebrow>{text}</Eyebrow>;
}

/** Sekcja poziomej linii. */
export function TSep() {
  return <View style={{ height: 2, backgroundColor: T.line2 }} />;
}

export function finishLater(api: TaskApi, ok: boolean, fb: Feedback, ms = 500) {
  setTimeout(() => api.finish(ok, fb), ms);
}

export function useTimer(seconds: number | undefined, onEnd: () => void, active = true) {
  const [left, setLeft] = useState(seconds ?? 0);
  const endRef = useRef(onEnd);
  useEffect(() => {
    endRef.current = onEnd;
  });
  useEffect(() => {
    if (!seconds || !active) return;
    const id = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          clearInterval(id);
          setTimeout(() => endRef.current(), 0);
          return 0;
        }
        return l - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [seconds, active]);
  return left;
}

/** Ładny zapis wartości liczbowej (wykres): przecinek dziesiętny. */
export const fmtV = (v: number) => String(v).replace(".", ",");

export function useTimedAnim(v: number, ms = 220) {
  const sv = useSharedValue(v);
  useEffect(() => {
    sv.set(withTiming(v, { duration: ms }));
  }, [v, ms, sv]);
  return sv;
}

const s = StyleSheet.create({
  body: { paddingTop: 20, paddingHorizontal: 18, paddingBottom: 24, gap: 16 },
  foot: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 26, gap: 10 },
  tile: { minHeight: 48, paddingVertical: 12, paddingHorizontal: 17, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  slot: { borderWidth: 2, borderStyle: "dashed", borderRadius: 16, alignItems: "flex-start", justifyContent: "center", paddingHorizontal: 14 },
  filled: { flexDirection: "row", alignItems: "center", gap: 9, borderWidth: 2, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14 },
});
