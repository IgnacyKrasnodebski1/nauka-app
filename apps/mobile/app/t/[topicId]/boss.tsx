import { BOSS_SEC, BOSS_WARN_SEC, bossAnswer, bossName, bossNext, finishBoss, startBoss, todayStr, type BossItem, type BossOutcome, type BossState, type Topic } from "@nauka/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { AccentProvider } from "@/components/Accent";
import { BossSvg } from "@/components/BossSvg";
import { Icon } from "@/components/Icon";
import { Bar, Confetti, Motion } from "@/components/Motion";
import { QuizBlock } from "@/components/QuizBlock";
import { NoHeartsSheet, type Feedback } from "@/components/Sheets";
import { TaskView } from "@/components/tasks";
import { Body, Display, Eyebrow, Muted, Num } from "@/components/Text";
import { Blob, Btn, Card, Empty, Loading, Screen, RoundBtn, useTop } from "@/components/ui";
import { haptic, useApp } from "@/lib/app-state";
import { fmtClock, noEmoji, npl } from "@/lib/format";
import { play } from "@/lib/sfx";
import { T, TONES } from "@/lib/theme";
import { levelWithOverrides, topicShort, visibleLevels } from "@/lib/topic-view";

const BG = "#110D22";

/** Boss rozdziału (Boss.html): pytania + zadania na czas, pasek życia bossa, serca gracza; wynik jak LevelComplete. */
export default function BossScreen() {
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  const app = useApp();
  const router = useRouter();
  const [topic, setTopic] = useState<Topic | null | undefined>(app.findTopic(topicId ?? ""));
  useEffect(() => {
    let alive = true;
    if (topicId && app.ready && !topic) app.getTopic(topicId).then((t) => alive && setTopic(t));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId, app.ready]);
  const close = useCallback(() => (router.canGoBack() ? router.back() : router.replace({ pathname: "/t/[topicId]", params: { topicId: topicId ?? "" } })), [router, topicId]);
  if (topic === undefined) return <Loading label="boss się szykuje…" />;
  if (!topic)
    return (
      <Screen>
        <Empty icon="alert" title="Nie ma takiego tematu" action={<Btn label="Wróć" onPress={close} />} />
      </Screen>
    );
  const subject = app.findSubject(topic.subjectId);
  return (
    <AccentProvider color={subject?.accent2 ?? topic.accent2} seed={subject?.name ?? topic.name}>
      <Boss topic={topic} onClose={close} />
    </AccentProvider>
  );
}

function Boss({ topic, onClose }: { topic: Topic; onClose: () => void }) {
  const app = useApp();
  const router = useRouter();
  const top = useTop();
  const subject = app.findSubject(topic.subjectId);
  const pool = { levels: visibleLevels(topic, app.extra.overrides).map((l) => levelWithOverrides(topic, l, app.extra.overrides)) };
  const [boot] = useState(() => {
    const s0 = startBoss(pool);
    const r = s0 ? bossNext(s0) : null;
    return { state: r ? r.state : s0, item: r?.item ?? null };
  });
  const [state, setState] = useState<BossState | null>(boot.state);
  const [item, setItem] = useState<BossItem | null>(boot.item);
  const [left, setLeft] = useState(BOSS_SEC);
  const [hit, setHit] = useState(0);
  const [miss, setMiss] = useState<string | null>(null);
  const [forced, setForced] = useState(false);
  const [out, setOut] = useState<BossOutcome | null>(null);
  const [win, setWin] = useState(false);
  const [noHearts, setNoHearts] = useState(() => !app.canStartLesson);
  const [conf, setConf] = useState(0);
  const answered = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const name = bossName({ name: topic.name, short: topic.short });

  const load = useCallback((s: BossState) => {
    const r = bossNext(s);
    setState(r.state);
    setItem(r.item);
    setLeft(BOSS_SEC);
    setForced(false);
    setMiss(null);
    answered.current = false;
  }, []);

  const end = useCallback(
    (s: BossState, won: boolean) => {
      if (timer.current) clearInterval(timer.current);
      const o = finishBoss(app.progressFor(topic.id).boss, s, won, todayStr());
      if (won) {
        app.setBoss(topic.id, o.record);
        if (o.xp) app.addXp(topic.id, o.xp);
        if (o.gems) app.addGems(o.gems);
        if (o.first) app.bumpStats((st) => ({ bosses: (st.bosses ?? 0) + 1 }));
        play("levelup");
        haptic.heavy();
        setTimeout(() => app.showToast(o.first ? `Boss pokonany: +${o.gems} gemów` : "Boss pokonany ponownie", "boss"), 300);
      } else play("wrong");
      setWin(won);
      setOut(o);
    },
    [app, topic.id],
  );

  const onAnswer = useCallback(
    (ok: boolean, fb: Feedback) => {
      if (answered.current || !state) return;
      answered.current = true;
      if (timer.current) clearInterval(timer.current);
      const r = bossAnswer(state, ok);
      setState(r.state);
      if (ok) {
        if (r.xp) app.addXp(topic.id, r.xp);
        setHit((n) => n + 1);
        setConf((n) => n + 1);
        haptic.ok();
      } else {
        if (r.loseHeart) app.loseHeart();
        haptic.bad();
        if (fb.e) setMiss(`${fb.sub ? fb.sub + ". " : ""}${fb.e}`);
      }
      const delay = ok ? 900 : fb.e ? 2300 : 1100;
      setTimeout(() => {
        if (r.won) return end(r.state, true);
        if (app.hearts.hearts - (r.loseHeart && !app.hearts.unlimited ? 1 : 0) <= 0 && !app.hearts.unlimited) return end(r.state, false);
        load(r.state);
      }, delay);
    },
    [state, app, topic.id, end, load],
  );

  useEffect(() => {
    if (!item || item.kind !== "quiz" || out) return;
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setLeft((l) => {
        if (answered.current) return l;
        if (l <= 1) {
          if (timer.current) clearInterval(timer.current);
          setForced(true);
          const q = item.q;
          onAnswer(false, { e: q.e, sub: `Czas minął. Poprawna: odpowiedź ${"ABCDE"[q.c] ?? q.c + 1}` });
          return 0;
        }
        return l - 1;
      });
    }, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, out]);

  const restart = () => {
    const s = startBoss(pool);
    setOut(null);
    setHit(0);
    setConf(0);
    if (!s) return app.showToast("Brak pytań do walki", "alert");
    if (!app.canStartLesson) {
      setNoHearts(true);
      setState(s);
      setItem(null);
      return;
    }
    load(s);
  };

  if (!state)
    return (
      <Screen style={{ backgroundColor: BG }}>
        <Empty icon="boss" title="Brak pytań do walki" text="Boss potrzebuje pytań i zadań z poziomów tego tematu." action={<Btn label="Wróć" onPress={onClose} />} />
      </Screen>
    );

  if (out) {
    const sec = out.seconds;
    return (
      <Screen scroll pad={false} style={{ backgroundColor: BG }} blob={<Blob tone={win ? "acid" : "red"} size={340} top={20} center />}>
        {win ? <Confetti n={8} colors={[T.violet, T.acid, T.gold, T.pink]} top={70} /> : null}
        <View style={[s.done, { paddingTop: top + 30 }]}>
          <Motion kind="pop">
            <View style={[s.bigTile, { backgroundColor: win ? TONES.violet.tint : TONES.red.tint, borderColor: win ? T.violet : T.red }]}>
              <Motion kind={win ? "none" : "shake"}>
                <BossSvg size={96} color={win ? T.violet : T.red} />
              </Motion>
              {win ? (
                <View style={s.won}>
                  <Icon name="check" size={22} stroke={4} color={T.onAcid} />
                </View>
              ) : null}
            </View>
          </Motion>
          <Motion kind="up" d={2} style={{ alignItems: "center" }}>
            <Display size={34} ls={-1.2} center lh={37}>
              {win ? "Boss pokonany" : "Boss wygrał tym razem"}
            </Display>
            <Muted size={14.5} weight={700} center style={{ marginTop: 8 }}>
              {name} · {subject ? noEmoji(subject.name) : topicShort(topic)}
            </Muted>
          </Motion>
          <View style={{ flexDirection: "row", gap: 10, alignSelf: "stretch" }}>
            {(
              [
                ["Ciosy", String(state.hits), T.acid, 3],
                ["Pudła", String(state.miss), state.miss ? T.pink : T.acid, 4],
                ["Czas", fmtClock(sec), T.gold, 5],
              ] as [string, string, string, number][]
            ).map(([k, v, c, d]) => (
              <Motion key={k} kind="up" d={d} style={{ flex: 1 }}>
                <Card padding={0} radius={20} drop={4}>
                  <View style={{ paddingVertical: 14, paddingHorizontal: 10, alignItems: "center" }}>
                    <Eyebrow size={10}>{k}</Eyebrow>
                    <Num size={26} color={c} style={{ marginTop: 4 }}>
                      {v}
                    </Num>
                  </View>
                </Card>
              </Motion>
            ))}
          </View>
          {win ? (
            <Motion kind="up" d={5} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {out.xp ? (
                <View style={[s.reward, { backgroundColor: TONES.gold.tint, borderColor: TONES.gold.tintLine }]}>
                  <Icon name="bolt" size={15} color={T.gold} />
                  <Body size={12.5} weight={800} color={TONES.gold.txt}>
                    +{out.xp} XP
                  </Body>
                </View>
              ) : null}
              {out.first ? (
                <>
                  <View style={[s.reward, { backgroundColor: TONES.cyan.tint, borderColor: TONES.cyan.tintLine }]}>
                    <Icon name="gem" size={15} color={T.cyan} />
                    <Body size={12.5} weight={800} color={TONES.cyan.txt}>
                      +{out.gems} gemów
                    </Body>
                  </View>
                  <View style={[s.reward, { backgroundColor: TONES.violet.tint, borderColor: TONES.violet.tintLine }]}>
                    <Icon name="boss" size={16} color={T.violet} />
                    <Body size={12.5} weight={800} color={TONES.violet.txt}>
                      odznaka
                    </Body>
                  </View>
                </>
              ) : (
                <View style={[s.reward, { backgroundColor: T.surface, borderColor: T.line }]}>
                  <Muted size={12.5} weight={800}>
                    powtórka walki · bez gemów
                  </Muted>
                </View>
              )}
            </Motion>
          ) : (
            <Muted size={13} center lh={19}>
              {app.hearts.hearts <= 0 && !app.hearts.unlimited ? "Skończyły się życia. Odzyskaj je (powtórka fiszek albo plecak) i spróbuj ponownie." : `Boss został z ${npl(state.hp, "życiem", "życiami", "życiami")}. Przejrzyj fiszki z tego tematu i wróć.`}
            </Muted>
          )}
          <View style={{ flex: 1 }} />
          <View style={{ alignSelf: "stretch", gap: 10 }}>
            <Btn label={win ? "Wracam na ścieżkę" : "Spróbuj ponownie"} tone={win ? "acid" : "violet"} glow onPress={win ? onClose : restart} />
            <Btn label={win ? "Jeszcze raz" : "Wróć na ścieżkę"} variant="text" onPress={win ? restart : onClose} />
          </View>
        </View>
      </Screen>
    );
  }

  const warn = left <= BOSS_WARN_SEC;
  return (
    <Screen pad={false} style={{ backgroundColor: BG }} blob={<Blob tone="boss" size={340} top={20} center />}>
      <View style={[s.head, { paddingTop: top }]}>
        <RoundBtn icon="close" onPress={() => { onClose(); app.showToast("Boss czeka na ścieżce", "boss"); }} label="Uciekaj z walki" />
        <Eyebrow size={11} color="#D6B4F5" style={{ flex: 1 }}>
          Boss rozdziału
        </Eyebrow>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          {app.hearts.unlimited ? (
            <Body size={14} weight={800} color="#FF8FA3">
              ∞
            </Body>
          ) : (
            Array.from({ length: Math.max(0, app.hearts.hearts) }, (_, i) => (
              <Motion key={i} kind="beat">
                <Icon name="heart" size={18} fill color={T.red} />
              </Motion>
            ))
          )}
          {!app.hearts.unlimited && app.hearts.hearts <= 0 ? <Icon name="heart" size={18} color={T.red} /> : null}
        </View>
      </View>
      <View style={s.hero}>
        <View>
          <Motion key={hit} kind={hit ? "shake" : "none"}>
            <BossSvg size={118} color={T.violet} />
          </Motion>
          {hit ? (
            <Motion key={`h${hit}`} kind="pop" d={2} style={s.hit}>
              <Body size={15} weight={800} color={T.onRed}>
                −1
              </Body>
            </Motion>
          ) : null}
        </View>
        <Display size={22} ls={-0.5} center>
          {name}
        </Display>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, alignSelf: "stretch" }}>
          <View style={s.hp}>
            <Bar pct={(state.hp / state.max) * 100} color={T.red} height={12} animate={false} />
          </View>
          <Body size={13} weight={800} color="#FF8FA3">
            {state.hp} / {state.max}
          </Body>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 26, gap: 12, flexGrow: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {conf ? <Confetti key={conf} n={3} colors={[T.violet, T.acid, T.gold]} top={0} /> : null}
        {item ? (
          <Motion key={item.kind === "quiz" ? `${state.n}-q` : `${state.n}-t`} kind="up" d={2}>
            <Card padding={16} radius={22} drop={5}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <Eyebrow>Cios {state.n}</Eyebrow>
                {item.kind === "quiz" ? (
                  <Motion kind={warn ? "blink" : "none"}>
                    <Body size={12} weight={800} color={warn ? T.red : "#FFB27A"}>
                      {fmtClock(left)}
                    </Body>
                  </Motion>
                ) : null}
              </View>
              {item.kind === "quiz" ? (
                <QuizBlock key={`${state.n}`} q={item.q} n={state.n} total={state.max} tag={item.lvl} onAnswer={(i, ok) => onAnswer(ok, { e: item.q.e })} revealForced={forced} footInline disabled={forced} />
              ) : (
                <View style={{ minHeight: 380 }}>
                  <TaskView key={`${state.n}`} task={item.task} n={state.n} total={state.max} tag={item.lvl} onFinish={(ok, fb) => onAnswer(ok, fb)} />
                </View>
              )}
            </Card>
          </Motion>
        ) : null}
        {miss ? (
          <Motion kind="up">
            <View style={s.exp}>
              <Body size={13} weight={700} color={TONES.red.txt} lh={18}>
                <Body size={13} weight={800} color={TONES.red.txt}>
                  Zapamiętaj:{" "}
                </Body>
                {miss}
              </Body>
            </View>
          </Motion>
        ) : null}
        <Muted size={12} weight={700} center style={{ marginTop: "auto" }}>
          Dobra odpowiedź = cios. Zła = tracisz serce. Boss ma {npl(state.max, "życie", "życia", "żyć")}.
        </Muted>
      </ScrollView>
      <NoHeartsSheet open={noHearts} onLeave={() => { setNoHearts(false); onClose(); }} onResume={() => { setNoHearts(false); if (state && !item) load(state); }} onCards={() => router.replace({ pathname: "/s/[subjectId]/cards", params: { subjectId: topic.subjectId, topicId: topic.id, heal: "1" } })} />
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18 },
  hero: { paddingHorizontal: 18, paddingTop: 12, alignItems: "center", gap: 10 },
  hit: { position: "absolute", top: -4, right: -30, paddingVertical: 5, paddingHorizontal: 11, borderRadius: 999, backgroundColor: T.red, shadowColor: T.redDark, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 4 } },
  hp: { flex: 1, borderWidth: 2, borderColor: T.dash, borderRadius: 999, padding: 0, overflow: "hidden" },
  exp: { backgroundColor: TONES.red.tint, borderWidth: 2, borderColor: TONES.red.tintLine, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14 },
  done: { flex: 1, paddingHorizontal: 22, alignItems: "center", gap: 18 },
  bigTile: { width: 132, height: 132, borderRadius: 66, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  won: { position: "absolute", right: 2, bottom: 2, width: 34, height: 34, borderRadius: 17, backgroundColor: T.acid, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: BG },
  reward: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 2, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
});
