import { PRACTICE_TASK_XP, TASK_META, allTasks, type Task, type TaskType, type Topic } from "@nauka/shared";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useApp } from "@/lib/app-state";
import { noEmoji, npl } from "@/lib/format";
import { T, TONES } from "@/lib/theme";
import { quizPool, shuffle, visibleLevels, type QuizRef } from "@/lib/topic-view";
import { useAccent } from "./Accent";
import { Icon } from "./Icon";
import { Bar, Confetti, Motion } from "./Motion";
import { QuizBlock } from "./QuizBlock";
import { ExplainSheet, SheetBad, SheetOk, SourceSheet, type Feedback, type QCtx } from "./Sheets";
import { TaskView } from "./tasks";
import { Body, Display, Muted } from "./Text";
import { Btn, Card, Chip, IconTile, Press } from "./ui";

/** Wynik rundy (quiz / ćwiczenia): kafel z ikoną, „Trafione N/M”, komentarz, „Jeszcze raz”. */
function RoundResult({ score, total, onAgain, extra }: { score: number; total: number; onAgain: () => void; extra?: React.ReactNode }) {
  const pct = total ? Math.round((score / total) * 100) : 0;
  const tone = pct >= 70 ? TONES.acid : pct >= 50 ? TONES.gold : TONES.red;
  return (
    <Motion kind="up">
      <Card padding={22} radius={26}>
        <View style={{ alignItems: "center", gap: 10 }}>
          <Motion kind="pop">
            <View style={[s.big, { backgroundColor: tone.color, shadowColor: tone.dark }]}>
              <Icon name={pct >= 70 ? "flame" : pct >= 50 ? "check" : "close"} size={54} stroke={3.2} color={tone.on} />
            </View>
          </Motion>
          <Display size={26} center>
            Wynik
          </Display>
          <Body size={14} color={T.txt2} center>
            Trafione{" "}
            <Body size={14} weight={800}>
              {score}/{total}
            </Body>{" "}
            ({pct}%)
          </Body>
          <Muted center lh={18}>
            {pct >= 70 ? "Dobrze znasz ten materiał." : pct >= 50 ? "Nieźle. Przejrzyj jeszcze fiszki." : "Wróć do fiszek i ścieżki, a potem spróbuj ponownie."}
          </Muted>
          <Btn label="Jeszcze raz" onPress={onAgain} style={{ alignSelf: "stretch", marginTop: 6 }} />
          {extra}
        </View>
      </Card>
    </Motion>
  );
}

/**
 * Zakładka „Quiz” (legacy `renderQuiz`): pytania całego tematu (filtr po poziomie), kafle + panele dobrze/źle, bez serc i combo;
 * +3 XP za trafienie, błędne trafiają do `weak` (Dziś: „Powtórz błędy”), koniec = plan dnia „quiz”.
 */
export function QuizTab({ topic, levelId }: { topic: Topic; levelId?: string }) {
  const app = useApp();
  const router = useRouter();
  const [lvl, setLvl] = useState<string>(levelId && topic.levels.some((l) => l.id === levelId) ? levelId : "all");
  const build = (l: string) => shuffle(quizPool(topic, app.extra.overrides, l === "all" ? null : [l]));
  const [list, setList] = useState<QuizRef[]>(() => build(lvl));
  const [round, setRound] = useState(0);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [sheet, setSheet] = useState<{ ok: boolean; xp: number; q: QuizRef } | null>(null);
  const [explain, setExplain] = useState<QCtx | null>(null);
  const [src, setSrc] = useState<QCtx | null>(null);
  const [conf, setConf] = useState(0);
  const restart = (l = lvl) => {
    setLvl(l);
    setList(build(l));
    setRound((r) => r + 1);
    setIdx(0);
    setScore(0);
    setSheet(null);
  };
  const cur = list[idx];
  const levels = visibleLevels(topic, app.extra.overrides);
  const ctxOf = (q: QuizRef): QCtx => ({ topic, level: topic.levels.find((l) => l.id === q.levelId)!, qi: q.qi, q: q.q });
  const onAnswer = (q: QuizRef, i: number, ok: boolean) => {
    const level = topic.levels.find((l) => l.id === q.levelId)!;
    app.setWeak(topic.id, level.id, ok ? [] : [q.qi], ok ? [q.qi] : []);
    app.questEvent({ type: "answer", correct: ok, combo: 0 });
    let xp = 0;
    if (ok) {
      xp = app.addXp(topic.id, 3);
      setScore((v) => v + 1);
      setConf((c) => c + 1);
    }
    setSheet({ ok, xp, q });
  };
  const next = () => {
    setSheet(null);
    const n = idx + 1;
    setIdx(n);
    if (n >= list.length && list.length) app.completeDaily(topic.subjectId, "quiz", lvl === "all" ? undefined : lvl);
  };
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
        <Chip label="Wszystko" active={lvl === "all"} onPress={() => restart("all")} />
        {levels.map((l) => (
          <Chip key={l.id} label={noEmoji(l.title)} active={lvl === l.id} onPress={() => restart(l.id)} />
        ))}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Bar pct={list.length ? (Math.min(idx, list.length) / list.length) * 100 : 0} color={T.acid} style={{ flex: 1 }} />
        <Body size={12} weight={800} color={T.muted}>
          {Math.min(idx + 1, list.length)}/{list.length}
        </Body>
      </View>
      {conf ? <Confetti key={conf} n={4} colors={[T.acid, T.gold, T.pink, T.cyan]} top={40} /> : null}
      {!list.length ? (
        <Card>
          <Muted center>Brak pytań w tym zakresie.</Muted>
        </Card>
      ) : !cur ? (
        <RoundResult score={score} total={list.length} onAgain={() => restart()} />
      ) : (
        <QuizBlock key={`${round}-${idx}`} q={cur.q} n={idx + 1} total={list.length} tag={lvl === "all" ? cur.lvl : undefined} onAnswer={(i, ok) => onAnswer(cur, i, ok)} footInline />
      )}
      {sheet ? (
        sheet.ok ? (
          <SheetOk open fb={{ e: sheet.q.q.e }} xp={sheet.xp} mult={1} combo={0} onNext={next} q={sheet.q.q} onSource={sheet.q.q.src ? () => setSrc(ctxOf(sheet.q)) : undefined} />
        ) : (
          <SheetBad open fb={{ e: sheet.q.q.e }} q={sheet.q.q} onNext={next} onExplain={() => setExplain(ctxOf(sheet.q))} onEdit={() => router.push({ pathname: "/edit-question", params: { topicId: topic.id, levelId: sheet.q.levelId, qi: String(sheet.q.qi) } })} onSource={sheet.q.q.src ? () => setSrc(ctxOf(sheet.q)) : undefined} />
        )
      ) : null}
      <ExplainSheet open={!!explain} ctx={explain} onClose={() => setExplain(null)} />
      <SourceSheet open={!!src} q={src?.q} ctx={src} onClose={() => setSrc(null)} onEdit={src ? () => { const c = src; setSrc(null); router.push({ pathname: "/edit-question", params: { topicId: topic.id, levelId: c.level.id, qi: String(c.qi ?? 0) } }); } : undefined} />
    </View>
  );
}

/**
 * Zakładka „Ćwiczenia” (legacy `renderCwicz` + `cwStartTasks`): zadania tematu pogrupowane po typie (`TASK_META`), ta sama
 * ramka i panele co w lekcji, bez serc i combo, +4 XP za zadanie.
 */
export function TasksTab({ topic }: { topic: Topic }) {
  const app = useApp();
  const acc = useAccent();
  const tasks: (Task & { lvl: string })[] = allTasks({ levels: visibleLevels(topic, app.extra.overrides) }).map((x) => ({ ...x.task, lvl: x.lvl }));
  const [type, setType] = useState<TaskType | null>(null);
  const [list, setList] = useState<(Task & { lvl: string })[]>([]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [sheet, setSheet] = useState<{ ok: boolean; xp: number; fb: Feedback } | null>(null);
  const [conf, setConf] = useState(0);
  const start = (t: TaskType) => {
    const l = shuffle(tasks.filter((x) => x.type === t));
    if (!l.length) return app.showToast("Brak zadań tego typu", "info");
    setType(t);
    setList(l);
    setIdx(0);
    setScore(0);
    setSheet(null);
  };
  const cur = list[idx];
  const onFinish = (ok: boolean, fb: Feedback) => {
    let xp = 0;
    if (ok) {
      xp = app.addXp(topic.id, PRACTICE_TASK_XP);
      setScore((v) => v + 1);
      setConf((c) => c + 1);
    }
    app.questEvent({ type: "task", won: ok, timed: cur?.type === "tf" && !!(cur as { seconds?: number }).seconds, perfect: ok });
    setSheet({ ok, xp, fb });
  };
  const next = () => {
    setSheet(null);
    setIdx((i) => i + 1);
  };
  if (!type)
    return (
      <View style={{ gap: 12 }}>
        <Muted size={12.5} weight={700}>
          {tasks.length ? "Zadania z poziomów" : "Ten temat nie ma jeszcze zadań — powstają razem z poziomami."}
        </Muted>
        {(Object.keys(TASK_META) as TaskType[]).map((t, i) => {
          const n = tasks.filter((x) => x.type === t).length;
          if (!n) return null;
          const m = TASK_META[t];
          const set = TONES[m.tone];
          return (
            <Motion key={t} kind="up" d={Math.min(6, i + 1)}>
              <Press onPress={() => start(t)} drop={4} edge={T.shadow} radius={20} faceStyle={s.excard} accessibilityLabel={`${m.label}: ${npl(n, "zadanie", "zadania", "zadań")}`}>
                <IconTile icon={m.icon} size={46} color={set.tint} on={set.color} />
                <View style={{ flex: 1 }}>
                  <Body size={14} weight={800}>
                    {m.label}
                  </Body>
                  <Muted size={12} style={{ marginTop: 2 }} numberOfLines={2}>
                    {npl(n, "zadanie", "zadania", "zadań")} · {m.desc}
                  </Muted>
                </View>
                <Icon name="chevron-right" size={18} color={T.muted2} />
              </Press>
            </Motion>
          );
        })}
      </View>
    );
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Bar pct={list.length ? (Math.min(idx, list.length) / list.length) * 100 : 0} color={acc.color} style={{ flex: 1 }} />
        <Body size={12} weight={800} color={T.muted}>
          {Math.min(idx + 1, list.length)}/{list.length}
        </Body>
      </View>
      {conf ? <Confetti key={conf} n={4} colors={[T.acid, T.gold, T.pink, T.cyan]} top={40} /> : null}
      {!cur ? (
        <RoundResult score={score} total={list.length} onAgain={() => start(type)} extra={<Btn label="Wróć do ćwiczeń" variant="ghost" onPress={() => setType(null)} style={{ alignSelf: "stretch" }} />} />
      ) : (
        <View style={{ minHeight: 420 }}>
          <TaskView key={`${type}-${idx}`} task={cur} n={idx + 1} total={list.length} tag={cur.lvl} onFinish={onFinish} onHintXp={(n) => app.addXp(topic.id, -n)} />
        </View>
      )}
      {sheet ? sheet.ok ? <SheetOk open fb={sheet.fb} xp={sheet.xp} mult={1} combo={0} onNext={next} /> : <SheetBad open fb={sheet.fb} onNext={next} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  big: { width: 100, height: 100, borderRadius: 30, alignItems: "center", justifyContent: "center", shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 6 } },
  excard: { flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: T.surface, borderWidth: 2, borderColor: T.line, paddingVertical: 13, paddingHorizontal: 14 },
});
