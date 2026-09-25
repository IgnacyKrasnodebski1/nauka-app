import { chainBank, checkChain, checkFill, checkMatch, checkOrder, checkSort, checkTimeline, fillBank, fillSlots, leftText, shuffle, shuffledOrder, type ChainTask, type FillTask, type MatchTask, type OrderTask, type SortTask, type TimelineTask } from "@nauka/shared";
import React, { useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Icon } from "@/components/Icon";
import { Motion } from "@/components/Motion";
import { Body, Display, Eyebrow } from "@/components/Text";
import { Btn, Card, Note, Press, Touch } from "@/components/ui";
import { npl } from "@/lib/format";
import { haptic } from "@/lib/haptic";
import { play } from "@/lib/sfx";
import { T, TONES, body } from "@/lib/theme";
import { DropSlot, FilledSlot, TSep, TaskFrame, WordTile, useDropZones, type TaskProps } from "./frame";

function fx(ok: boolean) {
  if (ok) {
    play("correct");
    haptic.ok();
  } else {
    play("wrong");
    haptic.bad();
  }
}

/* ============================================================ UZUPEŁNIJ ZDANIE (TaskFill.html) */
export function FillView({ task, api }: TaskProps<FillTask>) {
  const parts = useMemo(() => String(task.text).split(/\{(\d+)\}/), [task.text]);
  const slotIds = useMemo(() => fillSlots(task.text), [task.text]);
  const tiles = useMemo(() => fillBank(task).map((w, k) => ({ w, k })), [task]);
  const [slots, setSlots] = useState<(number | null)[]>(() => task.blanks.map(() => null));
  const [locked, setLocked] = useState<null | boolean[]>(null);
  const [last, setLast] = useState(-1);
  const used = new Set(slots.filter((x): x is number => x != null));
  const firstEmpty = slots.indexOf(null);
  const place = (k: number, si = firstEmpty) => {
    if (locked || si < 0 || used.has(k)) return;
    const next = [...slots];
    next[si] = k;
    setSlots(next);
    setLast(si);
  };
  const clear = (si: number) => {
    if (locked || slots[si] == null) return;
    const next = [...slots];
    next[si] = null;
    setSlots(next);
    setLast(-1);
  };
  const check = () => {
    if (locked || slots.some((x) => x == null)) return;
    const r = checkFill(task, slots.map((k) => (k == null ? "" : tiles[k]!.w)));
    setLocked(r.per);
    fx(r.ok);
    const full = parts.map((p, idx) => (idx % 2 === 0 ? p : task.blanks[+p] ?? "")).join("");
    api.finish(r.ok, r.ok ? { e: task.e } : { e: task.e, list: [{ t: full }], sub: "Poprawne zdanie niżej" });
  };
  return (
    <TaskFrame title={task.title ?? "Wstaw brakujące słowa"} foot={<Btn label="Sprawdź" tone="acid" disabled={slots.some((x) => x == null) || !!locked} onPress={check} />}>
      <Card padding={20} radius={26} drop={6}>
        <Text style={s.filltxt}>
          {parts.map((p, idx) => {
            if (idx % 2 === 0) return <Text key={idx}>{p}</Text>;
            const si = +p;
            const t = slots[si];
            const good = locked ? locked[si] : null;
            const cur = si === firstEmpty && !locked;
            return (
              <Text key={idx} onPress={() => clear(si)} style={[s.slot, t != null ? (good === false ? s.slotBad : s.slotOn) : cur ? s.slotCur : null, good === true && s.slotOk]}>
                {" "}
                {t != null ? tiles[t]!.w : "?"}{" "}
              </Text>
            );
          })}
        </Text>
      </Card>
      <View>
        <Eyebrow>Do wyboru</Eyebrow>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 13 }}>
          {tiles.map((t, k) => (
            <WordTile key={k} text={t.w} used={used.has(t.k)} d={Math.min(6, k + 1)} onPress={() => place(t.k)} dragEnabled={false} />
          ))}
        </View>
      </View>
      {task.hint ? (
        <Motion kind="up" d={3}>
          <Note tone="gold" icon="bookmark" text={"Podpowiedź: " + task.hint} />
        </Motion>
      ) : null}
      {last >= 0 && slotIds.length > 1 && !locked ? <Body size={12} weight={600} color={T.muted2}>Dotknij wypełnionej luki, żeby cofnąć.</Body> : null}
    </TaskFrame>
  );
}

/* ============================================================ POŁĄCZ W PARY (TaskMatch.html) */
export function MatchView({ task, api }: TaskProps<MatchTask>) {
  const pairs = task.pairs;
  const n = pairs.length;
  const L = useMemo(() => shuffle(pairs.map((p, i) => ({ i, t: p[0] }))), [pairs]);
  const R = useMemo(() => shuffle(pairs.map((p, i) => ({ i, t: p[1] }))), [pairs]);
  const [selL, setSelL] = useState<number | null>(null);
  const [selR, setSelR] = useState<number | null>(null);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [bad, setBad] = useState<number | null>(null);
  const mistakes = useRef(0);
  const busy = useRef(false);
  const left = n - done.size;
  const tryPair = (l: number | null, r: number | null) => {
    if (l == null || r == null) return;
    if (l === r) {
      const nd = new Set(done);
      nd.add(l);
      setDone(nd);
      setSelL(null);
      setSelR(null);
      play("correct");
      haptic.ok();
      if (nd.size >= n) {
        const ok = checkMatch(task, mistakes.current);
        setTimeout(() => api.finish(ok, ok ? { e: task.e } : { list: pairs.map((p) => ({ b: p[0], t: p[1] })), sub: `${npl(mistakes.current, "pomyłka", "pomyłki", "pomyłek")} po drodze` }), 500);
      }
    } else {
      mistakes.current++;
      busy.current = true;
      setBad(l * 1000 + r);
      play("wrong");
      haptic.bad();
      setTimeout(() => {
        setBad(null);
        setSelL(null);
        setSelR(null);
        busy.current = false;
      }, 900);
    }
  };
  const tap = (side: "l" | "r", i: number) => {
    if (busy.current || done.has(i)) return;
    if (side === "l") {
      const v = selL === i ? null : i;
      setSelL(v);
      tryPair(v, selR);
    } else {
      const v = selR === i ? null : i;
      setSelR(v);
      tryPair(selL, v);
    }
  };
  const col = (items: { i: number; t: string }[], side: "l" | "r") => (
    <View style={{ flex: 1, gap: 11 }}>
      {items.map((o, k) => {
        const isDone = done.has(o.i);
        const sel = side === "l" ? selL === o.i : selR === o.i;
        const isBad = bad != null && (side === "l" ? Math.floor(bad / 1000) === o.i : bad % 1000 === o.i);
        const face = isDone ? { backgroundColor: TONES.acid.tint, borderColor: TONES.acid.tintLine, opacity: 0.7 } : isBad ? { backgroundColor: TONES.red.tint, borderColor: T.red } : sel ? { backgroundColor: TONES.cyan.tint, borderColor: T.cyan } : { backgroundColor: T.surface, borderColor: T.line };
        const inner = (
          <Press onPress={isDone ? undefined : () => tap(side, o.i)} drop={isDone ? 0 : 4} edge={isBad ? T.redDark : sel ? TONES.cyan.tintLine : T.shadow} radius={18} faceStyle={[s.mbtn, face]} accessibilityLabel={o.t} silent>
            {isDone ? <Icon name="check" size={16} stroke={3.4} color="#7FA352" /> : null}
            <Body size={side === "l" ? 13.5 : 13} weight={side === "l" ? 800 : 700} color={isDone ? "#7FA352" : isBad ? TONES.red.txt : sel ? TONES.cyan.txt : T.txt2} lh={18} style={{ flex: 1 }}>
              {o.t}
            </Body>
          </Press>
        );
        return (
          <View key={o.i}>{isDone ? <Motion kind="pop">{inner}</Motion> : isBad ? <Motion kind="shake">{inner}</Motion> : sel ? <Motion kind="pulse">{inner}</Motion> : <Motion kind="up" d={Math.min(6, k + 1)}>{inner}</Motion>}</View>
        );
      })}
    </View>
  );
  return (
    <TaskFrame title={task.title ?? "Połącz w pary"} sub={left ? `${left === 1 ? "Została" : "Zostały"} ${npl(left, "para", "pary", "par")} z ${n}.` : "Wszystkie pary połączone."} foot={<Btn label={left ? "Połącz wszystkie pary" : "Gotowe"} tone="acid" disabled />}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        {col(L, "l")}
        {col(R, "r")}
      </View>
    </TaskFrame>
  );
}

/* ============================================================ USTAW KOLEJNOŚĆ (TaskOrder.html) */
const ROW_H = 62 + 10;
export function OrderView({ task, api }: TaskProps<OrderTask>) {
  const items = task.items;
  const n = items.length;
  const [order, setOrder] = useState<number[]>(() => shuffledOrder(n));
  const [locked, setLocked] = useState<boolean[] | null>(null);
  const [dragPos, setDragPos] = useState<number | null>(null);
  const move = (from: number, to: number) => {
    if (locked || to < 0 || to >= n || from === to) return;
    const next = [...order];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x!);
    setOrder(next);
  };
  const check = () => {
    if (locked) return;
    const r = checkOrder(task, order);
    setLocked(order.map((it, pos) => it === pos));
    fx(r.ok);
    api.finish(r.ok, r.ok ? { e: task.e } : { e: task.e, list: items.map((t, i) => ({ b: `${i + 1}.`, t })), sub: "Poprawna kolejność niżej" });
  };
  return (
    <TaskFrame title={task.title ?? "Ustaw kolejność"} sub="Przeciągnij za uchwyt albo użyj strzałek, żeby ułożyć od pierwszego do ostatniego." foot={<Btn label="Sprawdź kolejność" tone="acid" disabled={!!locked} onPress={check} />}>
      <View style={{ gap: 10 }}>
        {order.map((it, pos) => (
          <OrderRow key={it} pos={pos} n={n} text={items[it]!} state={locked ? (locked[pos] ? "ok" : "bad") : null} onMove={(to) => move(pos, to)} onDragTo={(to) => move(pos, to)} dragging={dragPos === pos} setDragging={(v) => setDragPos(v ? pos : null)} placeholder={dragPos != null && dragPos !== pos && false} />
        ))}
      </View>
    </TaskFrame>
  );
}
function OrderRow({ pos, n, text, state, onMove, onDragTo, dragging, setDragging }: { pos: number; n: number; text: string; state: "ok" | "bad" | null; onMove: (to: number) => void; onDragTo: (to: number) => void; dragging: boolean; setDragging: (v: boolean) => void; placeholder: boolean }) {
  const ty = useSharedValue(0);
  const z = useSharedValue(0);
  const pan = Gesture.Pan()
    .enabled(!state)
    .onStart(() => {
      z.set(1);
      runOnJS(setDragging)(true);
    })
    .onUpdate((e) => {
      ty.set(e.translationY);
    })
    .onEnd((e) => {
      const to = Math.max(0, Math.min(n - 1, pos + Math.round(e.translationY / ROW_H)));
      ty.set(0);
      z.set(0);
      runOnJS(setDragging)(false);
      if (to !== pos) runOnJS(onDragTo)(to);
    })
    .onFinalize(() => {
      ty.set(withSpring(0));
      z.set(0);
    });
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }, { scale: z.value ? 1.02 : 1 }], zIndex: z.value ? 20 : 0, elevation: z.value ? 6 : 0 }));
  const face = state === "ok" ? { backgroundColor: TONES.acid.tint, borderColor: TONES.acid.tintLine } : state === "bad" ? { backgroundColor: TONES.red.tint, borderColor: TONES.red.tintLine } : dragging ? { backgroundColor: TONES.violet.tint, borderColor: T.violet } : { backgroundColor: T.surface, borderColor: T.line };
  const num = dragging ? { bg: T.violet, on: T.onViolet } : state === "ok" ? { bg: T.acid, on: T.onAcid } : state === "bad" ? { bg: T.red, on: T.onRed } : { bg: T.line2, on: T.muted };
  const inner = (
    <View style={[s.orow, face, dragging && { shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 10 } }]}>
      <View style={[s.onum, { backgroundColor: num.bg }]}>
        <Body size={14} weight={800} color={num.on}>
          {pos + 1}
        </Body>
      </View>
      <Body size={14.5} weight={800} color={state === "bad" ? TONES.red.txt : T.txt} style={{ flex: 1 }}>
        {text}
      </Body>
      {!state ? (
        <>
          <Touch onPress={() => onMove(pos - 1)} disabled={pos === 0} hitSlop={6} accessibilityLabel="Przesuń wyżej" style={s.ud}>
            <Icon name="chevron-up" size={18} color={T.muted} />
          </Touch>
          <Touch onPress={() => onMove(pos + 1)} disabled={pos === n - 1} hitSlop={6} accessibilityLabel="Przesuń niżej" style={s.ud}>
            <Icon name="chevron-down" size={18} color={T.muted} />
          </Touch>
        </>
      ) : (
        <Icon name={state === "ok" ? "check" : "close"} size={18} stroke={3.4} color={state === "ok" ? T.acid : T.red} />
      )}
      {!state ? (
        <GestureDetector gesture={pan}>
          <Animated.View style={s.handle} accessible accessibilityLabel="Uchwyt do przeciągania">
            <Icon name="grip" size={18} color={T.muted2} />
          </Animated.View>
        </GestureDetector>
      ) : null}
    </View>
  );
  return <Animated.View style={[st, { backgroundColor: dragging ? "#12081C" : T.shadow, borderRadius: 18, paddingBottom: dragging ? 10 : 4 }]}>{state === "bad" ? <Motion kind="shake">{inner}</Motion> : inner}</Animated.View>;
}

/* ============================================================ PRZYPISZ DO KATEGORII (TaskSort.html) */
export function SortView({ task, api }: TaskProps<SortTask>) {
  const buckets = task.buckets.slice(0, 4);
  const items = useMemo(() => buckets.flatMap((b, bi) => b.items.map((t) => ({ t, b: bi }))), [buckets]);
  const poolOrder = useMemo(() => shuffle(items.map((_, i) => i)), [items]);
  const [at, setAt] = useState<(number | null)[]>(() => items.map(() => null));
  const [sel, setSel] = useState<number | null>(null);
  const [locked, setLocked] = useState<Set<string> | null>(null);
  const { register, zoneAt } = useDropZones();
  const left = at.filter((x) => x == null).length;
  const put = (i: number, bi: number | null) => {
    if (locked) return;
    const next = [...at];
    next[i] = bi;
    setAt(next);
    setSel(null);
  };
  const check = () => {
    if (locked || left) return;
    const placement: Record<string, number> = {};
    items.forEach((it, i) => (placement[it.t] = at[i] ?? -1));
    const r = checkSort(task, placement);
    setLocked(new Set(r.wrong));
    fx(r.ok);
    api.finish(r.ok, r.ok ? { e: task.e } : { e: task.e, list: buckets.map((b) => ({ b: b.name + ":", t: b.items.join(", ") })), sub: "Poprawny podział niżej" });
  };
  const drop = (i: number, x: number, y: number) => {
    const z = zoneAt(x, y);
    if (z == null) return false;
    put(i, +z.replace("b", ""));
    return true;
  };
  return (
    <TaskFrame title={task.title ?? "Który to instrument?"} foot={<Btn label={left ? "Przypisz wszystkie" : "Sprawdź"} tone="acid" disabled={left > 0 || !!locked} onPress={check} />}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 11 }}>
        {buckets.map((b, bi) => {
          const hot = sel != null;
          const inner = (
            <View style={[s.bucket, hot && { backgroundColor: TONES.violet.tint, borderColor: T.violet }]}>
              <Eyebrow color={hot ? TONES.violet.txt : T.muted2}>{b.name}</Eyebrow>
              {items.map((it, i) =>
                at[i] === bi ? (
                  <Touch key={i} onPress={() => (locked ? null : put(i, null))} accessibilityLabel={it.t}>
                    <View style={[s.bitem, locked && (locked.has(it.t) ? { backgroundColor: TONES.red.tint, borderColor: T.red } : {})]}>
                      <Body size={12.5} weight={800} color={locked?.has(it.t) ? TONES.red.txt : "#D9F5BC"}>
                        {it.t}
                      </Body>
                    </View>
                  </Touch>
                ) : null,
              )}
              <DropSlot id={`b${bi}`} register={register} cur={hot} label={hot ? "upuść tutaj" : undefined} height={34} style={{ alignItems: "center", flexGrow: 1 }} onPress={hot ? () => put(sel!, bi) : undefined} />
            </View>
          );
          return (
            <View key={bi} style={{ width: "47%", flexGrow: 1 }}>
              {hot ? <Motion kind="glow">{inner}</Motion> : inner}
            </View>
          );
        })}
      </View>
      <TSep />
      <View>
        <Eyebrow>{left ? `Zostało ${left}` : "Wszystko przypisane"}</Eyebrow>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 13 }}>
          {poolOrder.map((i) => (at[i] == null ? <WordTile key={i} text={items[i]!.t} sel={sel === i} onPress={() => setSel(sel === i ? null : i)} onDrop={(x, y) => drop(i, x, y)} /> : null))}
        </View>
      </View>
    </TaskFrame>
  );
}

/* ============================================================ OŚ CZASU (Timeline.html) */
export function TimelineView({ task, api }: TaskProps<TimelineTask>) {
  const evs = task.events.map((e, k) => ({ ...e, k }));
  const rows = useMemo(() => [...evs].sort((a, b) => a.year - b.year), [task]); // eslint-disable-line react-hooks/exhaustive-deps
  const poolOrder = useMemo(() => shuffle(evs.map((e) => e.k)), [task]); // eslint-disable-line react-hooks/exhaustive-deps
  const [slots, setSlots] = useState<(number | null)[]>(() => rows.map(() => null));
  const [sel, setSel] = useState<number | null>(null);
  const [locked, setLocked] = useState<boolean[] | null>(null);
  const { register, zoneAt } = useDropZones();
  const firstEmpty = slots.indexOf(null);
  const left = slots.filter((x) => x == null).length;
  const pin = (si: number, k: number) => {
    if (locked) return;
    const next = [...slots];
    next[si] = k;
    setSlots(next);
    setSel(null);
  };
  const check = () => {
    if (locked || left) return;
    const r = checkTimeline(task, slots.map((x) => x ?? -1));
    setLocked(r.per);
    fx(r.ok);
    api.finish(r.ok, r.ok ? { e: task.e } : { e: task.e, list: rows.map((rw) => ({ b: String(rw.year), t: rw.label })), sub: "Poprawna oś czasu niżej" });
  };
  const drop = (k: number, x: number, y: number) => {
    const z = zoneAt(x, y);
    if (z == null) return false;
    pin(+z.replace("t", ""), k);
    return true;
  };
  return (
    <TaskFrame title={task.title ?? "Przypnij wydarzenia do dat"} foot={<Btn label="Sprawdź" tone="acid" disabled={left > 0 || !!locked} onPress={check} />}>
      <View style={{ gap: 14, position: "relative" }}>
        <View style={{ position: "absolute", left: 73, top: 20, bottom: 20, width: 4, borderRadius: 2, backgroundColor: T.line2 }} />
        {rows.map((r, si) => {
          const t = slots[si];
          const cur = si === firstEmpty && !locked;
          return (
            <View key={si} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Display size={18} style={{ width: 54, textAlign: "right" }} ls={0}>
                {r.year}
              </Display>
              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: t != null ? T.acid : cur ? T.violet : T.line2, borderWidth: 3, borderColor: T.bg, zIndex: 1 }} />
              <View style={{ flex: 1 }}>
                {t != null ? (
                  <FilledSlot text={evs[t]!.label} state={locked ? (locked[si] ? "ok" : "bad") : undefined} onPress={() => pin(si, null as unknown as number)} />
                ) : (
                  <DropSlot id={`t${si}`} register={register} cur={cur} label={cur ? (sel != null ? "upuść tutaj" : "tu trafi wydarzenie") : undefined} onPress={sel != null ? () => pin(si, sel) : undefined} />
                )}
              </View>
            </View>
          );
        })}
      </View>
      <TSep />
      <Eyebrow>{left ? leftText(left) : "Wszystko przypięte"}</Eyebrow>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {poolOrder.map((k, pos) => (slots.includes(k) ? null : <WordTile key={k} text={evs[k]!.label} sel={sel === k} d={Math.min(6, pos + 1)} onPress={() => setSel(sel === k ? null : k)} onDrop={(x, y) => drop(k, x, y)} />))}
      </View>
    </TaskFrame>
  );
}

/* ============================================================ ŁAŃCUCH PRZYCZYN (CauseChain.html) */
export function ChainView({ task, api }: TaskProps<ChainTask>) {
  const steps = task.steps;
  const given = useMemo(() => new Set(task.given), [task]);
  const tiles = useMemo(() => chainBank(task), [task]);
  const [slots, setSlots] = useState<(number | null | -1)[]>(() => steps.map((_, k) => (given.has(k) ? -1 : null)));
  const [locked, setLocked] = useState<boolean[] | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const { register, zoneAt } = useDropZones();
  const firstEmpty = slots.indexOf(null);
  const used = new Set(slots.filter((x): x is number => typeof x === "number" && x >= 0));
  const put = (k: number, i: number | null) => {
    if (locked || k < 0) return;
    const next = [...slots];
    next[k] = i;
    setSlots(next);
    setSel(null);
  };
  const check = () => {
    if (locked || slots.some((x) => x == null)) return;
    const filled: Record<number, string> = {};
    slots.forEach((t, k) => {
      if (typeof t === "number" && t >= 0) filled[k] = tiles[t]!;
    });
    const r = checkChain(task, filled);
    setLocked(r.per);
    fx(r.ok);
    api.finish(r.ok, r.ok ? { e: task.e } : { e: task.e, list: steps.map((st, k) => ({ b: `${k + 1}.`, t: st })), sub: "Poprawny łańcuch niżej" });
  };
  const drop = (i: number, x: number, y: number) => {
    const z = zoneAt(x, y);
    if (z == null) return false;
    put(+z.replace("c", ""), i);
    return true;
  };
  return (
    <TaskFrame title={task.title ?? "Co się dzieje po kolei?"} foot={<Btn label="Sprawdź" tone="acid" disabled={slots.some((x) => x == null) || !!locked} onPress={check} />}>
      <View style={{ gap: 4 }}>
        {steps.map((st, k) => {
          const t = slots[k];
          const cur = k === firstEmpty && !locked;
          return (
            <React.Fragment key={k}>
              {k ? (
                <View style={{ alignItems: "center" }}>
                  <Icon name="arrow-down" size={22} stroke={3} color={T.muted2} />
                </View>
              ) : null}
              {t === -1 ? (
                <Motion kind="up" d={Math.min(6, k + 1)}>
                  <Card padding={0} radius={16}>
                    <View style={{ paddingVertical: 13, paddingHorizontal: 15 }}>
                      <Body size={14} weight={800}>
                        {st}
                      </Body>
                    </View>
                  </Card>
                </Motion>
              ) : t != null ? (
                <FilledSlot text={tiles[t]!} state={locked ? (locked[k] ? "ok" : "bad") : undefined} onPress={() => put(k, null)} />
              ) : (
                <DropSlot id={`c${k}`} register={register} cur={cur} label={cur ? (sel != null ? "upuść tutaj" : "co dalej?") : undefined} height={50} onPress={sel != null ? () => put(k, sel) : undefined} />
              )}
            </React.Fragment>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {tiles.map((w, i) => (
          <WordTile
            key={i}
            text={w}
            used={used.has(i)}
            sel={sel === i}
            d={Math.min(6, i + 1)}
            onPress={() => {
              if (sel === i) setSel(null);
              else if (firstEmpty >= 0 && sel == null) put(firstEmpty, i);
              else setSel(i);
            }}
            onDrop={(x, y) => drop(i, x, y)}
          />
        ))}
      </View>
    </TaskFrame>
  );
}

const s = StyleSheet.create({
  filltxt: { fontFamily: body(700), fontSize: 17, lineHeight: 36, color: T.txt2 },
  slot: { fontFamily: body(800), fontSize: 15, color: T.muted3, backgroundColor: T.surface2, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 2, borderColor: T.muted3, overflow: "hidden" },
  slotCur: { borderColor: T.muted3, color: T.muted3 },
  slotOn: { backgroundColor: TONES.acid.tint, borderColor: T.acid, color: TONES.acid.txt },
  slotOk: { backgroundColor: TONES.acid.tint, borderColor: T.acid, color: TONES.acid.txt },
  slotBad: { backgroundColor: TONES.red.tint, borderColor: T.red, color: TONES.red.txt },
  mbtn: { minHeight: 76, padding: 13, borderWidth: 2, flexDirection: "row", alignItems: "center", gap: 8 },
  orow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 2, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, minHeight: 62 },
  onum: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  ud: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  handle: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  bucket: { backgroundColor: T.surface, borderWidth: 2, borderColor: T.line, borderRadius: 20, padding: 13, minHeight: 118, gap: 9 },
  bitem: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 13, backgroundColor: TONES.acid.tint, borderWidth: 2, borderColor: TONES.acid.tintLine },
});
