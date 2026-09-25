import { TYPETERM_HINT_XP, checkMathSteps, checkSwipe, checkTf, checkTypeTerm, hotspotHit, shuffle, type ChartTask, type FindErrorTask, type HotspotTask, type MathStepsTask, type ScenarioTask, type SwipeTask, type TfTask, type ThesisTask, type TypeTermTask } from "@nauka/shared";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Image, StyleSheet, TextInput, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { ChartSvg } from "@/components/ChartSvg";
import { Icon } from "@/components/Icon";
import { Bar, Motion } from "@/components/Motion";
import { Option } from "@/components/QuizBlock";
import { Body, Display, Eyebrow, Muted } from "@/components/Text";
import { Btn, Card, Dots, Note, Press, Tag, Touch } from "@/components/ui";
import { KEYS_ABC, fmtClock, npl } from "@/lib/format";
import { haptic } from "@/lib/haptic";
import { useReduceMotion } from "@/lib/motion";
import { play } from "@/lib/sfx";
import { T, TONES, body, display } from "@/lib/theme";
import { TaskFrame, fmtV, useChooser, useTimer, type TaskProps } from "./frame";

/* ============================================================ PRAWDA / FAŁSZ (TaskTrueFalse.html) */
export function TfView({ task, api }: TaskProps<TfTask>) {
  const sts = useMemo(() => shuffle(task.statements), [task]);
  const n = sts.length;
  const total = task.seconds ?? 0;
  const [i, setI] = useState(0);
  const [results, setResults] = useState<(boolean | null)[]>(() => sts.map(() => null));
  const [exp, setExp] = useState<{ ok: boolean; text: string } | null>(null);
  const busy = useRef(false);
  const ended = useRef(false);
  const answersRef = useRef<(boolean | null)[]>(sts.map(() => null));

  const end = (final: (boolean | null)[]) => {
    if (ended.current) return;
    ended.current = true;
    const r = checkTf(task, final.map((v, k) => (v == null ? !sts[k]!.v : sts[k]!.v === v ? sts[k]!.v : !sts[k]!.v)));
    const wrong = sts.filter((_, k) => final[k] !== true);
    const bad = wrong.length;
    api.finish(r.ok && bad === 0, bad ? { list: wrong.map((w) => ({ b: w.s, t: `${w.v ? "prawda" : "fałsz"}${w.e ? ". " + w.e : ""}` })), sub: `Nietrafione: ${bad} z ${n}` } : { e: task.e });
  };
  const left = useTimer(total || undefined, () => {
    const final = answersRef.current.map((v) => v ?? false);
    setResults(final);
    end(final);
  });
  const answer = (v: boolean) => {
    if (busy.current || ended.current || i >= n) return;
    const st = sts[i]!;
    const ok = st.v === v;
    const next = [...answersRef.current];
    next[i] = ok;
    answersRef.current = next;
    setResults(next);
    setExp({ ok, text: (ok ? "Zgadza się" : `Nie — to ${st.v ? "prawda" : "fałsz"}`) + (st.e ? ". " + st.e : ".") });
    if (ok) {
      play("correct");
      haptic.ok();
    } else {
      play("wrong");
      haptic.bad();
    }
    busy.current = true;
    setTimeout(
      () => {
        busy.current = false;
        setExp(null);
        if (i + 1 >= n) end(next);
        else setI(i + 1);
      },
      st.e ? 1700 : 800,
    );
  };
  const st = sts[i];
  return (
    <TaskFrame
      scroll={false}
      chips={total ? <Tag label={`${results.filter((r) => r === true).length} z rzędu`} /> : undefined}
      head={
        total ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Eyebrow color="#FFB27A">Runda na czas</Eyebrow>
              <Bar pct={total ? (left / total) * 100 : 100} color={T.flame} height={10} animate={false} style={{ marginTop: 5 }} />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Icon name="clock" size={17} color="#FFB27A" />
              {left <= 10 ? (
                <Motion kind="blink">
                  <Body size={16} weight={800} color="#FFB27A">
                    {fmtClock(left)}
                  </Body>
                </Motion>
              ) : (
                <Body size={16} weight={800} color="#FFB27A">
                  {fmtClock(left)}
                </Body>
              )}
            </View>
          </View>
        ) : undefined
      }
      foot={
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Press onPress={() => answer(true)} drop={6} edge={T.acidDark} radius={22} style={{ flex: 1 }} faceStyle={[s.tfbtn, { backgroundColor: T.acid }]} accessibilityLabel="Prawda">
            <Icon name="check" size={24} stroke={3.4} color={T.onAcid} />
            <Body size={14} weight={800} color={T.onAcid} ls={1.2}>
              PRAWDA
            </Body>
          </Press>
          <Press onPress={() => answer(false)} drop={6} edge={T.redDark} radius={22} style={{ flex: 1 }} faceStyle={[s.tfbtn, { backgroundColor: T.red }]} accessibilityLabel="Fałsz">
            <Icon name="close" size={24} stroke={3.4} color={T.onRed} />
            <Body size={14} weight={800} color={T.onRed} ls={1.2}>
              FAŁSZ
            </Body>
          </Press>
        </View>
      }
    >
      <Motion kind={exp ? (exp.ok ? "pop" : "shake") : "up"} style={{ flex: 1 }} key={i}>
        <View style={[s.tfcard, exp && { borderColor: exp.ok ? T.acid : T.red }]}>
          <Display size={27} center ls={-0.9} lh={32}>
            {st?.s ?? ""}
          </Display>
          <View style={{ alignItems: "center", marginTop: 18 }}>
            <View style={s.tfmeta}>
              <Body size={11.5} weight={800} color={T.amber}>
                {i + 1} z {n}
              </Body>
            </View>
          </View>
        </View>
      </Motion>
      {exp ? (
        <Motion kind="up">
          <Note tone={exp.ok ? "acid" : "red"} icon={exp.ok ? "check" : "close"} text={exp.text} />
        </Motion>
      ) : null}
      <Dots n={n} results={results} cur={i} />
    </TaskFrame>
  );
}

/* ============================================================ WPISZ POJĘCIE (TypeTerm.html) */
export function TypeTermView({ task, api, onSource }: TaskProps<TypeTermTask> & { onSource?: () => void }) {
  const ans = String(task.answer ?? "");
  const letters = ans.replace(/\s+/g, "").length;
  const tol = task.typo ?? 1;
  const [val, setVal] = useState("");
  const [locked, setLocked] = useState<null | "ok" | "bad">(null);
  const [hinted, setHinted] = useState(false);
  const ref = useRef<TextInput>(null);
  useEffect(() => {
    const t = setTimeout(() => ref.current?.focus(), 200);
    return () => clearTimeout(t);
  }, []);
  const typed = val.replace(/\s+/g, "").length;
  const check = () => {
    if (locked || !val.trim()) return;
    const ok = checkTypeTerm(task, val);
    setLocked(ok ? "ok" : "bad");
    if (ok) {
      play("correct");
      haptic.ok();
    } else {
      play("wrong");
      haptic.bad();
    }
    api.finish(ok, { e: task.e, sub: ok ? "" : "Poprawnie: " + ans });
  };
  const hint = () => {
    if (locked || hinted) return;
    setHinted(true);
    if (!val) setVal(ans.charAt(0));
    api.hintXp?.(-TYPETERM_HINT_XP);
    ref.current?.focus();
  };
  const giveUp = () => {
    if (locked) return;
    setVal(ans);
    setLocked("bad");
    play("wrong");
    api.finish(false, { e: task.e, sub: "Poprawnie: " + ans });
  };
  const box = (
    <View style={[s.termbox, locked === "ok" ? { borderColor: T.acid } : locked === "bad" ? { borderColor: T.red } : { borderColor: T.acid }]}>
      <TextInput ref={ref} value={val} onChangeText={(t) => !locked && setVal(t)} editable={!locked} autoCapitalize="none" autoCorrect={false} spellCheck={false} onSubmitEditing={check} returnKeyType="done" accessibilityLabel="Twoja odpowiedź" style={s.terminput} placeholderTextColor={T.muted3} />
      {!locked ? (
        <Motion kind="blink">
          <View style={{ width: 3, height: 28, borderRadius: 2, backgroundColor: T.acid }} />
        </Motion>
      ) : null}
    </View>
  );
  return (
    <TaskFrame title={task.title ?? "Jak to się nazywa?"} foot={<Btn label="Sprawdź" tone="acid" disabled={!val.trim() || !!locked} onPress={check} />}>
      <Motion kind="up" d={1}>
        <Card padding={20} radius={24} drop={6}>
          <Eyebrow>Definicja</Eyebrow>
          <Body size={16.5} weight={700} lh={25} style={{ marginTop: 9 }}>
            {task.definition}
          </Body>
          {task.src && onSource ? (
            <Touch onPress={onSource} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 }}>
              <Icon name="file" size={15} color={T.gold} />
              <Body size={12.5} weight={800} color={T.gold}>
                Skąd to?{task.src.page ? ` Materiał, str. ${task.src.page}` : " Twój materiał"}
              </Body>
            </Touch>
          ) : null}
        </Card>
      </Motion>
      <Motion kind="up" d={2}>
        <Eyebrow>Twoja odpowiedź</Eyebrow>
        <View style={{ marginTop: 9 }}>{locked === "bad" ? <Motion kind="shake">{box}</Motion> : box}</View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 12 }}>
          {ans.split("").map((ch, k) =>
            /\s/.test(ch) ? <View key={k} style={{ width: 8 }} /> : <View key={k} style={{ width: 20, height: 5, borderRadius: 3, backgroundColor: k < typed + ans.slice(0, k).replace(/\S/g, "").length ? T.acid : T.line2 }} />,
          )}
        </View>
        <Muted size={12} weight={700} style={{ marginTop: 7 }}>
          {npl(letters, "litera", "litery", "liter")}
          {tol ? " · literówka w jednym miejscu jest akceptowana" : ""}
        </Muted>
      </Motion>
      <Motion kind="up" d={3} style={{ flexDirection: "row", gap: 10 }}>
        <Touch onPress={hint} disabled={hinted || !!locked} accessibilityRole="button" style={[s.hintbtn, { backgroundColor: TONES.gold.tint, borderColor: TONES.gold.tintLine }]}>
          <Body size={12.5} weight={800} color={TONES.gold.txt}>
            {hinted ? `Zaczyna się na „${ans.charAt(0).toUpperCase()}”` : `Pierwsza litera · −${TYPETERM_HINT_XP} XP`}
          </Body>
        </Touch>
        <Touch onPress={giveUp} disabled={!!locked} accessibilityRole="button" style={[s.hintbtn, { backgroundColor: T.surface, borderColor: T.line }]}>
          <Body size={12.5} weight={800} color={T.muted}>
            Nie pamiętam
          </Body>
        </Touch>
      </Motion>
    </TaskFrame>
  );
}

/* ============================================================ DWIE KATEGORIE (Swipe.html) */
export function SwipeView({ task, api }: TaskProps<SwipeTask>) {
  const cards = useMemo(() => shuffle(task.cards), [task]);
  const n = cards.length;
  const L = task.left || "Lewo",
    R = task.right || "Prawo";
  const [i, setI] = useState(0);
  const [results, setResults] = useState<(boolean | null)[]>(() => cards.map(() => null));
  const [sides, setSides] = useState<("left" | "right" | null)[]>(() => cards.map(() => null));
  const [busy, setBusy] = useState(false);
  const reduce = useReduceMotion();
  const tx = useSharedValue(0),
    ty = useSharedValue(0),
    fly = useSharedValue(0);
  const [near, setNear] = useState<"left" | "right" | null>(null);
  const [zoneFx, setZoneFx] = useState<{ side: "left" | "right"; ok: boolean } | null>(null);

  const answer = (side: "left" | "right") => {
    if (busy || i >= n) return;
    setBusy(true);
    const c = cards[i]!;
    const ok = c.side === side;
    const next = [...sides];
    next[i] = side;
    setSides(next);
    setResults((r) => r.map((v, k) => (k === i ? ok : v)));
    setZoneFx({ side, ok });
    setNear(null);
    if (ok) {
      play("correct");
      haptic.ok();
    } else {
      play("wrong");
      haptic.bad();
    }
    fly.set(withTiming(side === "left" ? -1 : 1, { duration: reduce ? 0 : 320 }));
    setTimeout(
      () => {
        setZoneFx(null);
        fly.set(0);
        tx.set(0);
        ty.set(0);
        setBusy(false);
        if (i + 1 >= n) {
          const r = checkSwipe(task, next);
          const wrong = r.wrong.map((k) => cards[k]!);
          api.finish(r.ok, r.ok ? { e: task.e } : { list: wrong.map((c) => ({ b: c.front, t: `${c.side === "left" ? L : R}${c.e ? ". " + c.e : ""}` })), sub: `Nietrafione: ${wrong.length} z ${n}` });
        } else setI(i + 1);
      },
      ok ? 420 : 800,
    );
  };
  const pan = Gesture.Pan()
    .onUpdate((e) => {
      tx.set(e.translationX);
      ty.set(e.translationY * 0.25);
      const nr = e.translationX < -30 ? "left" : e.translationX > 30 ? "right" : null;
      runOnJS(setNear)(nr);
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > 80) runOnJS(answer)(e.translationX < 0 ? "left" : "right");
      else {
        tx.set(withSpring(0));
        ty.set(withSpring(0));
        runOnJS(setNear)(null);
      }
    });
  const cardSt = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value + fly.value * 420 }, { translateY: ty.value }, { rotate: `${(tx.value + fly.value * 200) / 14}deg` }], opacity: 1 - Math.abs(fly.value) * 0.6 }));
  const c = cards[i];
  const stampL = near === "left",
    stampR = near === "right";
  return (
    <TaskFrame
      scroll={false}
      chips={
        <Body size={12.5} weight={800} color={T.muted} style={{ marginLeft: "auto" }}>
          {Math.min(i + 1, n)} / {n}
        </Body>
      }
      title={task.title ?? `${L} czy ${R}?`}
      foot={
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Press onPress={() => answer("left")} drop={5} edge={TONES.red.tintShadow} radius={20} style={{ flex: 1 }} faceStyle={[s.swbtn, { backgroundColor: TONES.red.tint, borderColor: TONES.red.tintLine }]} accessibilityLabel={L}>
            <Icon name="back" size={18} stroke={3} color={TONES.red.txt} />
            <Body size={14} weight={800} color={TONES.red.txt} ls={1}>
              {L.toUpperCase()}
            </Body>
          </Press>
          <Press onPress={() => answer("right")} drop={5} edge={T.cyanDark} radius={20} style={{ flex: 1 }} faceStyle={[s.swbtn, { backgroundColor: T.cyan, borderColor: T.cyan }]} accessibilityLabel={R}>
            <Body size={14} weight={800} color={T.onCyan} ls={1}>
              {R.toUpperCase()}
            </Body>
            <Icon name="chevron-right" size={18} stroke={3} color={T.onCyan} />
          </Press>
        </View>
      }
    >
      <View style={{ flex: 1, minHeight: 360, position: "relative" }}>
        <View style={[s.zone, { left: 0, borderTopRightRadius: 22, borderBottomRightRadius: 22, backgroundColor: zoneFx?.side === "left" ? (zoneFx.ok ? TONES.acid.tint : TONES.red.tint) : TONES.red.tint, borderColor: stampL || zoneFx?.side === "left" ? (zoneFx?.side === "left" && !zoneFx.ok ? T.red : zoneFx?.side === "left" ? T.acid : T.red) : "transparent" }]}>
          <Body size={13} weight={800} color={TONES.red.txt} ls={3} style={{ transform: [{ rotate: "-90deg" }], width: 120, textAlign: "center" }}>
            {L.toUpperCase()}
          </Body>
        </View>
        <View style={[s.zone, { right: 0, borderTopLeftRadius: 22, borderBottomLeftRadius: 22, backgroundColor: zoneFx?.side === "right" ? (zoneFx.ok ? TONES.acid.tint : TONES.red.tint) : TONES.cyan.tint, borderColor: stampR || zoneFx?.side === "right" ? (zoneFx?.side === "right" && !zoneFx.ok ? T.red : zoneFx?.side === "right" ? T.acid : T.cyan) : "transparent" }]}>
          <Body size={13} weight={800} color={T.cyan} ls={3} style={{ transform: [{ rotate: "90deg" }], width: 120, textAlign: "center" }}>
            {R.toUpperCase()}
          </Body>
        </View>
        {i + 1 < n ? <View style={[s.scard, s.scardBack]} /> : null}
        {c ? (
          <GestureDetector gesture={pan}>
            <Animated.View style={[s.scard, s.scardFront, cardSt]} key={i}>
              {stampL ? (
                <View style={[s.stamp, { left: 18, borderColor: T.red, transform: [{ rotate: "12deg" }] }]}>
                  <Body size={15} weight={800} color={T.red} ls={2}>
                    {L.toUpperCase()}
                  </Body>
                </View>
              ) : null}
              {stampR ? (
                <View style={[s.stamp, { right: 18, borderColor: T.cyan, transform: [{ rotate: "-12deg" }] }]}>
                  <Body size={15} weight={800} color={T.cyan} ls={2}>
                    {R.toUpperCase()}
                  </Body>
                </View>
              ) : null}
              <Display size={String(c.front).length > 14 ? 28 : 46} center ls={-1} lh={String(c.front).length > 14 ? 34 : 52}>
                {c.front}
              </Display>
              {c.sub ? (
                <Body size={14} weight={700} color={T.muted} center style={{ marginTop: 12 }}>
                  {c.sub}
                </Body>
              ) : null}
            </Animated.View>
          </GestureDetector>
        ) : null}
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 8 }}>
          <Dots n={n} results={results} cur={i} size={8} />
        </View>
      </View>
    </TaskFrame>
  );
}

/* ============================================================ CZYJA TO TEZA (WhoSaid.html) */
export function ThesisView({ task, api }: TaskProps<ThesisTask>) {
  const ch = useChooser(task.c, api, (_s, ok) => ({ e: task.e, sub: ok ? "" : "Poprawnie: " + (task.options[task.c]?.name ?? "") }));
  return (
    <TaskFrame foot={<Btn label="Sprawdź" tone="acid" disabled={ch.sel == null || ch.done} onPress={ch.check} />}>
      <Motion kind="pop" d={1}>
        <Card padding={22} radius={26} drop={6}>
          <Icon name="quote" size={34} color={T.violet} />
          <Display size={22} ls={-0.6} lh={28} style={{ marginTop: 8 }}>
            {task.thesis}
          </Display>
        </Card>
      </Motion>
      <Eyebrow>{task.q ?? "Kto tak twierdzi?"}</Eyebrow>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 11 }}>
        {task.options.map((o, k) => {
          const st = ch.stateOf(k);
          const sel = st === "sel",
            ok = st === "correct",
            bad = st === "wrong",
            dim = st === "dim";
          const face = ok ? { backgroundColor: TONES.acid.tint, borderColor: T.acid } : bad ? { backgroundColor: TONES.red.tint, borderColor: T.red } : sel ? { backgroundColor: TONES.violet.tint, borderColor: T.violet } : { backgroundColor: T.surface, borderColor: T.line, opacity: dim ? 0.55 : 1 };
          const inner = (
            <Press onPress={ch.done ? undefined : () => ch.select(k)} drop={dim ? 0 : 4} edge={ok ? T.acid : bad ? T.redDark : sel ? T.violet : T.shadow} radius={18} faceStyle={[s.thopt, face]} accessibilityLabel={o.name}>
              <Body size={14.5} weight={800}>
                {o.name}
              </Body>
              {o.sub ? (
                <Body size={11.5} weight={700} color={sel ? TONES.violet.txt : T.muted}>
                  {o.sub}
                </Body>
              ) : null}
            </Press>
          );
          return (
            <View key={k} style={{ width: "48%", flexGrow: 1 }}>
              {ok ? <Motion kind="pop">{inner}</Motion> : bad ? <Motion kind="shake">{inner}</Motion> : <Motion kind="up" d={k + 1}>{inner}</Motion>}
            </View>
          );
        })}
      </View>
    </TaskFrame>
  );
}

/* ============================================================ SCENARIUSZ (Scenario.html) */
export function ScenarioView({ task, api }: TaskProps<ScenarioTask>) {
  const ch = useChooser(task.c, api, (_s, ok) => ({ e: task.e, sub: ok ? "" : "Poprawna: odpowiedź " + KEYS_ABC[task.c] }));
  return (
    <TaskFrame foot={<Btn label="Sprawdź" tone="acid" disabled={ch.sel == null || ch.done} onPress={ch.check} />}>
      <Motion kind="up" d={1}>
        <Card padding={16} radius={24} drop={6}>
          <Eyebrow>Sytuacja</Eyebrow>
          <Body size={15} weight={700} color={T.txt2} lh={22} style={{ marginTop: 8 }}>
            {task.scene}
          </Body>
        </Card>
      </Motion>
      <Motion kind="up" d={2}>
        <Display size={21} ls={-0.8} lh={25}>
          {task.q || "Co najlepiej to wyjaśnia?"}
        </Display>
      </Motion>
      <View style={{ gap: 10 }}>
        {task.a.map((a, k) => (
          <Option key={k} k={KEYS_ABC[k] ?? String(k + 1)} text={a} state={ch.stateOf(k)} small d={k + 2} glowCorrect={ch.done && ch.sel !== task.c} onPress={ch.done ? undefined : () => ch.select(k)} />
        ))}
      </View>
    </TaskFrame>
  );
}

/* ============================================================ WYKRES (ChartRead.html) */
export function ChartView({ task, api }: TaskProps<ChartTask>) {
  const ch = useChooser(task.c, api, (_s, ok) => ({ e: task.e, sub: ok ? "" : "Poprawna: odpowiedź " + KEYS_ABC[task.c] }));
  return (
    <TaskFrame foot={<Btn label="Sprawdź" tone="acid" disabled={ch.sel == null || ch.done} onPress={ch.check} />}>
      <Motion kind="up" d={1}>
        <Card padding={12} radius={24} drop={6}>
          {task.chart.label ? (
            <Body size={12} weight={800} color={T.muted} style={{ paddingHorizontal: 6, paddingBottom: 6 }}>
              {task.chart.label}
            </Body>
          ) : null}
          <ChartSvg kind={task.chart.kind} xs={task.chart.x} ys={task.chart.y} fmt={fmtV} />
        </Card>
      </Motion>
      <Motion kind="up" d={2}>
        <Display size={19} ls={-0.8} lh={23}>
          {task.q}
        </Display>
      </Motion>
      <View style={{ gap: 9 }}>
        {task.a.map((a, k) => (
          <Option key={k} k={KEYS_ABC[k] ?? String(k + 1)} text={a} state={ch.stateOf(k)} small d={k + 2} glowCorrect={ch.done && ch.sel !== task.c} onPress={ch.done ? undefined : () => ch.select(k)} />
        ))}
      </View>
    </TaskFrame>
  );
}

/* ============================================================ ZNAJDŹ BŁĄD (FindError.html) */
export function FindErrorView({ task, api }: TaskProps<FindErrorTask>) {
  const w = task.wrong | 0;
  const ch = useChooser(w, api, (_s, ok) => ({ e: task.e, sub: ok ? "" : "Fałszywe było zdanie " + (w + 1) }));
  return (
    <TaskFrame title={task.title ?? "Jedno zdanie jest fałszywe. Które?"} foot={<Btn label="Sprawdź" tone="acid" disabled={ch.sel == null || ch.done} onPress={ch.check} />}>
      <Card padding={12} radius={24} drop={6}>
        <View style={{ gap: 9 }}>
          {task.sentences.map((sen, k) => {
            const st = ch.stateOf(k);
            const sel = st === "sel" || st === "wrong";
            const isWrong = ch.done && k === w;
            const missed = ch.done && st === "wrong";
            const face = isWrong ? { backgroundColor: TONES.red.tint, borderColor: T.red } : missed ? { backgroundColor: TONES.amber.tint, borderColor: T.amber } : sel ? { backgroundColor: TONES.red.tint, borderColor: T.red } : { backgroundColor: T.surface2, borderColor: T.line2 };
            const inner = (
              <Press onPress={ch.done ? undefined : () => ch.select(k)} drop={sel && !ch.done ? 4 : 0} edge={T.redDark} radius={14} faceStyle={[s.errsent, face]} accessibilityLabel={sen}>
                <Body size={14.5} weight={700} color={isWrong ? TONES.red.txt : missed ? TONES.amber.txt : sel ? TONES.red.txt : T.txt2} lh={21} style={isWrong ? { textDecorationLine: "line-through" } : undefined}>
                  {sen}
                </Body>
              </Press>
            );
            return (
              <View key={k}>{sel && !ch.done ? <Motion kind="pop">{inner}</Motion> : <Motion kind="up" d={k + 1}>{inner}</Motion>}</View>
            );
          })}
          {ch.done ? (
            <Motion kind="up">
              <View style={[s.errfix, { backgroundColor: ch.sel === w ? TONES.acid.tint : TONES.red.tint, borderColor: ch.sel === w ? TONES.acid.tintLine : TONES.red.tintLine }]}>
                <Eyebrow color={ch.sel === w ? T.acid : TONES.red.txt}>{ch.sel === w ? "Trafione" : "Fałszywe było zdanie " + (w + 1)}</Eyebrow>
                <Body size={14} weight={700} color={T.txt} style={{ marginTop: 4 }}>
                  {task.fix ? "Poprawnie: " + task.fix : `Zdanie ${w + 1} jest fałszywe.`}
                </Body>
              </View>
            </Motion>
          ) : null}
        </View>
      </Card>
      {!ch.done ? (
        <Motion kind="up" d={5}>
          <Note tone="gold" icon="info" text="Po sprawdzeniu zobaczysz poprawione zdanie." />
        </Motion>
      ) : null}
    </TaskFrame>
  );
}

/* ============================================================ KROK PO KROKU (MathSteps.html) */
export function MathStepsView({ task, api }: TaskProps<MathStepsTask>) {
  const steps = task.steps;
  const [i, setI] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [hist, setHist] = useState<{ ok: boolean; expr: string; note: string }[]>([]);
  const [tried, setTried] = useState<Set<number>>(new Set());
  const [mistakes, setMistakes] = useState(0);
  const [locked, setLocked] = useState(false);
  const orderOf = (k: number) => shuffle(steps[k]?.options.map((_, j) => j) ?? []);
  const [order, setOrder] = useState(() => orderOf(0));
  const check = () => {
    if (locked || sel == null) return;
    const st = steps[i]!;
    const ok = sel === st.c;
    if (ok) {
      play("correct");
      haptic.ok();
      const h = [...hist, { ok: true, expr: st.expr || st.options[st.c] || "", note: st.note ?? "" }];
      setHist(h);
      setTried(new Set());
      setSel(null);
      if (i + 1 >= steps.length) {
        setLocked(true);
        api.finish(checkMathSteps(task, mistakes), { e: task.e, sub: mistakes ? `${npl(mistakes, "pomyłka", "pomyłki", "pomyłek")} po drodze` : "" });
      } else {
        setI(i + 1);
        setOrder(orderOf(i + 1));
      }
    } else {
      play("wrong");
      haptic.bad();
      setMistakes((m) => m + 1);
      setOrder(orderOf(i));
      setTried((t) => new Set([...t, sel]));
      setHist([...hist, { ok: false, expr: st.options[sel] ?? "", note: st.note ?? "Spróbuj inaczej." }]);
      setSel(null);
    }
  };
  const last = hist[hist.length - 1];
  return (
    <TaskFrame title={task.title ?? "Rozwiąż krok po kroku"} foot={<Btn label="Sprawdź" tone="acid" disabled={sel == null || locked} onPress={check} />}>
      <Card padding={12} radius={24} drop={6}>
        <View style={{ gap: 8 }}>
          <Motion kind="up" d={1}>
            <View style={[s.mrow, { backgroundColor: T.surface2 }]}>
              <Display size={26} ls={0.5} style={{ flex: 1 }}>
                {task.start}
              </Display>
              <Body size={11.5} weight={700} color="#7A74AA">
                zadanie
              </Body>
            </View>
          </Motion>
          {hist.map((h, k) => (
            <Motion key={k} kind={k === hist.length - 1 ? (h.ok ? "pop" : "shake") : "none"}>
              <View style={[s.mrow, h.ok ? { backgroundColor: TONES.acid.tint, borderWidth: 2, borderColor: TONES.acid.tintLine } : { backgroundColor: TONES.red.tint, borderWidth: 2, borderColor: TONES.red.tintLine }]}>
                <Display size={26} ls={0.5} color={h.ok ? TONES.acid.txt : TONES.red.txt} style={[{ flex: 1 }, !h.ok && { textDecorationLine: "line-through" }]}>
                  {h.expr}
                </Display>
                <Body size={11.5} weight={700} color={h.ok ? TONES.acid.sub : TONES.red.sub}>
                  {h.ok ? h.note : "nie tak"}
                </Body>
                <Icon name={h.ok ? "check" : "close"} size={16} stroke={3.4} color={h.ok ? T.acid : T.red} />
              </View>
            </Motion>
          ))}
          {last && !last.ok ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 6 }}>
              <Icon name="bulb" size={16} color={T.gold} />
              <Body size={13} weight={700} color={TONES.gold.txt} style={{ flex: 1 }}>
                {last.note}
              </Body>
            </View>
          ) : null}
          {!locked ? (
            <Motion kind="blink">
              <View style={[s.mnext]}>
                <Body size={13} weight={800} color={TONES.violet.txt}>
                  następny krok?
                </Body>
              </View>
            </Motion>
          ) : null}
        </View>
      </Card>
      <Eyebrow>{locked ? "Rozwiązane" : "Wybierz następny krok"}</Eyebrow>
      {!locked ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 11 }}>
          {order.map((k, pos) => {
            const opt = steps[i]!.options[k]!;
            const dis = tried.has(k);
            const on = sel === k;
            return (
              <View key={`${i}-${k}`} style={{ width: "47%", flexGrow: 1 }}>
                <Motion kind="up" d={pos + 2}>
                  <Press onPress={dis ? undefined : () => setSel(k)} drop={dis ? 0 : 4} edge={on ? T.violet : T.shadow} radius={18} faceStyle={[s.mopt, on ? { backgroundColor: TONES.violet.tint, borderColor: T.violet } : { backgroundColor: T.surface, borderColor: T.line, opacity: dis ? 0.4 : 1 }]} accessibilityLabel={opt}>
                    <Display size={22} ls={0}>
                      {opt}
                    </Display>
                  </Press>
                </Motion>
              </View>
            );
          })}
        </View>
      ) : null}
    </TaskFrame>
  );
}

/* ============================================================ WSKAŻ NA SCHEMACIE (Hotspot.html) */
export function HotspotView({ task, api }: TaskProps<HotspotTask>) {
  const tg = task.targets;
  const n = tg.length;
  const [i, setI] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [pins, setPins] = useState<{ x: number; y: number; r: number; kind: "ok" | "miss" | "reveal"; label?: string }[]>([]);
  const [size, setSize] = useState({ w: 1, h: 1 });
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [shake, setShake] = useState(0);
  const end = (m: number) => {
    setLocked(true);
    api.finish(m === 0, { e: task.e, sub: m ? `${npl(m, "pomyłka", "pomyłki", "pomyłek")} po drodze` : "" });
  };
  const tap = (px: number, py: number) => {
    if (locked || busy || i >= n) return;
    const x = (px / size.w) * 100,
      y = (py / size.h) * 100;
    const t = tg[i]!;
    if (hotspotHit(t, x, y, size.h / size.w)) {
      play("correct");
      haptic.ok();
      setPins((p) => [...p, { x: t.x, y: t.y, r: t.r, kind: "ok", label: t.name }]);
      if (i + 1 >= n) setTimeout(() => end(mistakes), 500);
      setI(i + 1);
    } else {
      play("wrong");
      haptic.bad();
      const m = mistakes + 1;
      setMistakes(m);
      setBusy(true);
      setShake((k) => k + 1);
      setPins((p) => [...p, { x, y, r: 4, kind: "miss" }]);
      setTimeout(() => {
        setPins((p) => p.filter((q) => q.kind !== "miss"));
        setBusy(false);
      }, 700);
    }
  };
  const show = () => {
    if (locked || busy || i >= n) return;
    const m = mistakes + 1;
    setMistakes(m);
    setBusy(true);
    const t = tg[i]!;
    setPins((p) => [...p, { x: t.x, y: t.y, r: t.r, kind: "reveal", label: t.name }]);
    setTimeout(() => {
      setBusy(false);
      if (i + 1 >= n) end(m);
      setI(i + 1);
    }, 1100);
  };
  const isSvg = /^\s*<svg/i.test(task.image);
  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const tapG = Gesture.Tap().onEnd((e) => runOnJS(tap)(e.x, e.y));
  return (
    <TaskFrame title={i < n ? "Dotknij: " + tg[i]!.name : "Wszystko wskazane"} foot={<Btn label="Pokaż, gdzie to jest" variant="ghost" onPress={show} disabled={i >= n} />}>
      <Motion kind={shake ? "shake" : "up"} key={shake} d={1}>
        <Card padding={12} radius={26} drop={6}>
          <GestureDetector gesture={tapG}>
            <View onLayout={onLayout} style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: 16, overflow: "hidden", backgroundColor: T.surface2 }} accessibilityLabel="Dotknij właściwego miejsca na schemacie">
              {!isSvg && task.image ? <Image source={{ uri: task.image }} style={{ width: "100%", height: "100%" }} resizeMode="contain" accessibilityLabel={task.alt} /> : <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Icon name="grid" size={40} color={T.muted3} /></View>}
              {pins.map((p, k) => (
                <View key={k} pointerEvents="none" style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, width: 0, height: 0, alignItems: "center", justifyContent: "center", overflow: "visible" }}>
                  <Motion kind={p.kind === "reveal" ? "blink" : "pop"} style={{ position: "absolute", width: (p.r * 2 * size.w) / 100, height: (p.r * 2 * size.w) / 100, borderRadius: 999, borderWidth: 4, borderColor: p.kind === "miss" ? T.red : p.kind === "reveal" ? T.gold : T.acid, backgroundColor: p.kind === "miss" ? T.red : "transparent" }} />
                  {p.label ? (
                    <Motion kind="pop" d={3} style={{ position: "absolute", top: (p.r * size.w) / 100 + 6 }}>
                      <View style={{ paddingVertical: 6, paddingHorizontal: 11, borderRadius: 10, backgroundColor: p.kind === "reveal" ? T.gold : T.acid }}>
                        <Body size={12} weight={800} color={T.onAcid}>
                          {p.label}
                        </Body>
                      </View>
                    </Motion>
                  ) : null}
                </View>
              ))}
            </View>
          </GestureDetector>
        </Card>
      </Motion>
      <Motion kind="up" d={2} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {tg.map((t, k) => (
          <View key={k} style={[s.hotchip, k < i ? { backgroundColor: TONES.acid.tint, borderColor: TONES.acid.tintLine } : k === i ? { backgroundColor: TONES.acid.tint, borderColor: T.acid } : {}]}>
            {k < i ? <Icon name="check" size={13} stroke={3.4} color={T.acid} /> : null}
            <Body size={12} weight={700} color={k <= i ? TONES.acid.txt : T.muted}>
              {k === i + 1 ? "Kolejne: " : ""}
              {t.name}
            </Body>
          </View>
        ))}
      </Motion>
    </TaskFrame>
  );
}

const s = StyleSheet.create({
  tfbtn: { height: 76, alignItems: "center", justifyContent: "center", gap: 3 },
  tfcard: { flex: 1, backgroundColor: T.surface, borderWidth: 2, borderColor: T.line, borderRadius: 30, paddingVertical: 28, paddingHorizontal: 24, justifyContent: "center", minHeight: 220 },
  tfmeta: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, backgroundColor: TONES.amber.tint },
  termbox: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: T.surface2, borderWidth: 2, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 16 },
  terminput: { flex: 1, minWidth: 0, color: T.txt, fontFamily: display(800), fontSize: 24, letterSpacing: 0.5, padding: 0 },
  hintbtn: { flex: 1, height: 46, borderRadius: 15, borderWidth: 2, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  swbtn: { height: 62, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 2 },
  zone: { position: "absolute", top: 30, bottom: 60, width: 64, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  scard: { position: "absolute", left: 50, right: 50, top: 12, height: 306, borderRadius: 28, borderWidth: 2 },
  scardBack: { left: 62, right: 62, top: 20, height: 300, backgroundColor: "#16142C", borderColor: "#221E42", transform: [{ rotate: "-3deg" }] },
  scardFront: { backgroundColor: T.surface, borderColor: T.cyan, alignItems: "center", justifyContent: "center", padding: 20 },
  stamp: { position: "absolute", top: 18, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, borderWidth: 3 },
  thopt: { minHeight: 86, padding: 14, borderWidth: 2, justifyContent: "space-between", gap: 6 },
  errsent: { borderWidth: 2, paddingVertical: 12, paddingHorizontal: 14 },
  errfix: { borderWidth: 2, borderRadius: 14, padding: 12 },
  mrow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14 },
  mnext: { height: 56, borderRadius: 14, borderWidth: 2, borderStyle: "dashed", borderColor: T.violet, backgroundColor: TONES.violet.tint, justifyContent: "center", paddingHorizontal: 14 },
  mopt: { height: 62, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  hotchip: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: T.surface2, borderWidth: 2, borderColor: T.line2 },
  _body: { fontFamily: body(600) },
});
