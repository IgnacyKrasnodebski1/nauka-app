import { HEART_REFILL_GEMS, HEARTS_MAX, formatCountdown, type Level, type QuizQuestion, type Topic } from "@nauka/shared";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { ApiError, tutorAsk } from "@/lib/api";
import { useApp } from "@/lib/app-state";
import { useAuth } from "@/lib/auth";
import { hasApi } from "@/lib/env";
import { KEYS_ABC, comboText, noEmoji } from "@/lib/format";
import { T, TONES } from "@/lib/theme";
import { Icon } from "./Icon";
import { Motion } from "./Motion";
import { Body, Display, Eyebrow, Muted } from "./Text";
import { Btn, Chip, IconTile, Press, RoundBtn, Sheet, Touch } from "./ui";

/** Wynik zadania/pytania przekazywany do paneli (legacy `fb`): wyjaśnienie, podtytuł, lista poprawnych. */
export interface Feedback {
  e?: string;
  sub?: string;
  list?: { b?: string; t?: string }[];
}

/** Kontekst pytania: temat/poziom/indeks (Źródło, Popraw, Wyjaśnij inaczej). */
export interface QCtx {
  topic: Topic;
  level: Level;
  qi?: number | null;
  q?: QuizQuestion;
}

/** Linia „Źródło: s. N — „cytat”” (legacy `srcLine`) → arkusz SourceView. */
export function SrcLine({ q, onPress }: { q: QuizQuestion | undefined; onPress: () => void }) {
  const src = q?.src;
  if (!src) return null;
  const parts = [src.material ? "materiał" : "", src.page ? `s. ${src.page}` : ""].filter(Boolean).join(" · ");
  return (
    <Touch onPress={onPress} accessibilityRole="button" style={s.src}>
      <Icon name="file" size={14} color={T.gold} />
      <Body size={12} weight={700} color={T.gold} style={{ flex: 1 }} numberOfLines={2}>
        Źródło{parts ? `: ${parts}` : ""}
        {src.quote ? ` — „${src.quote}”` : ""}
      </Body>
      <Icon name="chevron-right" size={14} color={T.gold} />
    </Touch>
  );
}

function FbList({ list, tone }: { list: Feedback["list"]; tone: "acid" | "red" }) {
  if (!list?.length) return null;
  return (
    <View style={[s.list, { backgroundColor: tone === "acid" ? "#17210D" : "#200A11" }]}>
      {list.map((it, i) => (
        <Body key={i} size={13.5} weight={600} color={tone === "acid" ? "#D9F5BC" : TONES.red.txt} lh={19}>
          {it.b ? (
            <Body size={13.5} weight={800} color={T.txt}>
              {it.b}
              {it.t ? " — " : ""}
            </Body>
          ) : null}
          {it.t ?? ""}
        </Body>
      ))}
    </View>
  );
}

/** Panel „Dobrze!” (`sheetOk`, QuizCorrect.html): ikona, combo, chip +XP, „Dlaczego”, DALEJ. */
export function SheetOk({ open, fb, xp, mult, combo, onNext, q, onSource }: { open: boolean; fb: Feedback; xp: number; mult: number; combo: number; onNext: () => void; q?: QuizQuestion; onSource?: () => void }) {
  return (
    <Sheet open={open} tone="acid" dismissable={false} handle={false}>
      <View style={s.row}>
        <Motion kind="pop" d={2}>
          <View style={[s.ico, { backgroundColor: T.acid }]}>
            <Icon name="check" size={26} stroke={3.6} color={T.onAcid} />
          </View>
        </Motion>
        <View style={{ flex: 1 }}>
          <Display size={24} color={T.acid} ls={-0.6}>
            Dobrze!
          </Display>
          <Body size={12.5} color={TONES.acid.sub}>
            {comboText(combo)}
          </Body>
        </View>
        <Motion kind="pop" d={3}>
          <View style={s.xpchip}>
            <Body size={14} weight={800} color={T.onGold}>
              +{xp} XP{mult > 1 ? ` ×${mult}` : ""}
            </Body>
          </View>
        </Motion>
      </View>
      {fb.e || fb.list?.length ? (
        <View style={[s.box, { backgroundColor: "#17210D" }]}>
          <Eyebrow color="#8FA87A">Dlaczego</Eyebrow>
          {fb.e ? (
            <Body size={14} weight={600} color="#D9F5BC" lh={21} style={{ marginTop: 5 }}>
              {fb.e}
            </Body>
          ) : null}
          <FbList list={fb.list} tone="acid" />
          {onSource ? <SrcLine q={q} onPress={onSource} /> : null}
        </View>
      ) : onSource && q?.src ? (
        <SrcLine q={q} onPress={onSource} />
      ) : null}
      <Btn label="Dalej" tone="acid" onPress={onNext} />
    </Sheet>
  );
}

/** Panel „Nie tym razem” (`sheetBad`, QuizWrong.html): poprawna litera, „Zapamiętaj”, WYJAŚNIJ INACZEJ / DALEJ, „Zgłoś / popraw”. */
export function SheetBad({ open, fb, onNext, q, onExplain, onEdit, onSource, nextLabel = "Dalej" }: { open: boolean; fb: Feedback; onNext: () => void; q?: QuizQuestion; onExplain?: () => void; onEdit?: () => void; onSource?: () => void; nextLabel?: string }) {
  const sub = fb.sub ?? (q && q.c != null ? `Poprawna: odpowiedź ${KEYS_ABC[q.c]}` : "");
  return (
    <Sheet open={open} tone="red" dismissable={false} handle={false}>
      <View style={s.row}>
        <View style={[s.ico, { backgroundColor: T.red }]}>
          <Icon name="close" size={24} stroke={3.6} color={T.onRed} />
        </View>
        <View style={{ flex: 1 }}>
          <Display size={24} color={TONES.red.txt} ls={-0.6}>
            Nie tym razem
          </Display>
          {sub ? (
            <Body size={12.5} color={TONES.red.sub}>
              {sub}
            </Body>
          ) : null}
        </View>
      </View>
      {fb.e || fb.list?.length ? (
        <View style={[s.box, { backgroundColor: "#200A11" }]}>
          <Eyebrow color={TONES.red.sub}>Zapamiętaj</Eyebrow>
          {fb.e ? (
            <Body size={14} weight={600} color={TONES.red.txt} lh={21} style={{ marginTop: 5 }}>
              {fb.e}
            </Body>
          ) : null}
          <FbList list={fb.list} tone="red" />
          {onSource ? <SrcLine q={q} onPress={onSource} /> : null}
        </View>
      ) : onSource && q?.src ? (
        <SrcLine q={q} onPress={onSource} />
      ) : null}
      <View style={{ flexDirection: "row", gap: 10 }}>
        {onExplain ? (
          <Press onPress={onExplain} drop={5} edge="#14060A" radius={18} style={{ flex: 1 }} faceStyle={[s.ghostBtn, { backgroundColor: "#200A11", borderColor: TONES.red.tintLine }]} accessibilityLabel="Wyjaśnij inaczej">
            <Body size={13} weight={800} color={TONES.red.txt} ls={1}>
              WYJAŚNIJ INACZEJ
            </Body>
          </Press>
        ) : null}
        <Btn label={nextLabel} tone="red" onPress={onNext} style={{ flex: 1 }} />
      </View>
      {onEdit ? (
        <Touch onPress={onEdit} accessibilityRole="button" style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 4 }}>
          <Icon name="edit" size={15} color={T.muted} />
          <Body size={13} weight={800} color={T.muted}>
            Zgłoś / popraw pytanie
          </Body>
        </Touch>
      ) : null}
    </Sheet>
  );
}

type ExplainMode = "Analogia" | "Przykład" | "Krok po kroku";
const PROMPTS: Record<ExplainMode, string> = {
  Analogia: "Wyjaśnij to pytanie i poprawną odpowiedź przez jedną prostą analogię z życia codziennego (3–4 zdania).",
  Przykład: "Podaj jeden konkretny przykład, który pokazuje, dlaczego poprawna odpowiedź jest właściwa (3–4 zdania).",
  "Krok po kroku": "Wyjaśnij poprawną odpowiedź krok po kroku, punktami (max 5 kroków).",
};

/**
 * „Wyjaśnijmy inaczej” (Explain.html): chipy Analogia / Przykład / Krok po kroku, treść z tutora AI (POST /api/tutor,
 * streaming). Bez API / offline: wyjaśnienie z danych (fiszka / „prościej” / „zapamiętaj” z roladki, legacy `explainFor`).
 */
export function ExplainSheet({ open, ctx, onClose }: { open: boolean; ctx: QCtx | null; onClose: () => void }) {
  const auth = useAuth();
  const app = useApp();
  const [mode, setMode] = useState<ExplainMode>("Analogia");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const q = ctx?.q;

  useEffect(() => {
    if (!open || !ctx || !q) return;
    let alive = true;
    const offline = offlineExplain(q, ctx.topic, ctx.level);
    (async () => {
      await Promise.resolve();
      if (!alive) return;
      setText("");
      setErr(null);
      if (!hasApi || app.offline) {
        setText(offline);
        return;
      }
      const token = await auth.accessToken();
      if (!token || !alive) {
        setText(offline);
        return;
      }
      setBusy(true);
      abort.current = new AbortController();
      try {
        const question = `${PROMPTS[mode]}\n\nPytanie: ${q.q}\nOdpowiedzi: ${q.a.map((a, i) => `${KEYS_ABC[i]}. ${a}`).join("; ")}\nPoprawna: ${KEYS_ABC[q.c]}. ${q.a[q.c]}${q.e ? `\nWyjaśnienie z materiału: ${q.e}` : ""}`;
        await tutorAsk(token, { topicId: ctx.topic.id, levelId: ctx.level.id, question, history: [] }, (t) => alive && setText(t), abort.current.signal);
      } catch (e) {
        if (!alive) return;
        setErr(e instanceof ApiError && e.code === "limit_reached" ? "Limit wyjaśnień AI na dziś wyczerpany — poniżej wyjaśnienie z materiałów." : "AI chwilowo niedostępne — poniżej wyjaśnienie z materiałów.");
        setText(offline);
      } finally {
        if (alive) setBusy(false);
      }
    })();
    return () => {
      alive = false;
      abort.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, q?.q]);

  return (
    <Sheet open={open} onClose={onClose} bg={T.surface2} tone="cyan" top={180} handle={false}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <IconTile icon="bulb" size={44} tone="cyan" kind="pop" />
        <Display size={22} ls={-0.6} style={{ flex: 1 }}>
          Wyjaśnijmy inaczej
        </Display>
        <RoundBtn icon="close" onPress={onClose} label="Zamknij" />
      </View>
      <View style={{ flexDirection: "row", gap: 7 }}>
        {(Object.keys(PROMPTS) as ExplainMode[]).map((m) => (
          <Chip key={m} label={m} tone="cyan" active={mode === m} onPress={() => setMode(m)} />
        ))}
      </View>
      <ScrollView style={{ flexGrow: 0, maxHeight: 340 }} showsVerticalScrollIndicator={false}>
        <Motion kind="up" d={2}>
          <View style={s.exbox}>
            {busy && !text ? <ActivityIndicator color={T.cyan} /> : null}
            {text ? (
              <Body size={15.5} weight={700} color={TONES.cyan.txt} lh={24}>
                {text}
              </Body>
            ) : null}
          </View>
        </Motion>
      </ScrollView>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon name="wifi" size={15} color={T.muted2} />
        <Muted size={11.5} weight={700}>
          {err ?? (hasApi && !app.offline ? "Tworzone przez AI na bieżąco · wymaga internetu" : "Wyjaśnienie z materiałów · AI wymaga internetu")}
        </Muted>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Btn label="Jeszcze inaczej" variant="ghost" small onPress={() => setMode((m) => (m === "Analogia" ? "Przykład" : m === "Przykład" ? "Krok po kroku" : "Analogia"))} style={{ width: 150 }} />
        <Btn label="Rozumiem" tone="cyan" onPress={onClose} style={{ flex: 1 }} />
      </View>
    </Sheet>
  );
}

const STOP = new Set(["jest", "jak", "czym", "ktore", "ktory", "ktora", "jaki", "jaka", "jakie", "oraz", "albo", "lub", "nie", "tak", "dla", "sie", "przez", "tego", "tym", "ten", "czy", "ile", "kto", "gdzie", "kiedy", "moze", "jego", "jej", "ich", "tylko", "bardzo", "oznacza", "polega", "przyklad", "wedlug", "miedzy", "pod", "nad", "przy", "bez", "jako", "wobec", "ktorych", "ktorym", "czego", "czemu", "dlaczego", "zawsze", "nigdy", "wszystkie", "nazywa", "nazywamy", "byla", "byly", "beda", "bedzie", "jednak", "wtedy", "niz", "ktorego", "robi", "ma", "sa"]);
const fold = (str: string) =>
  String(str || "")
    .replace(/<[^>]+>/g, " ")
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
const words = (str: string) => fold(str).split(" ").filter((w) => w.length >= 4 && !STOP.has(w));
const stem = (w: string) => (w.length > 6 ? w.slice(0, -2) : w.length > 4 ? w.slice(0, -1) : w);
function overlap(qs: string[], txt: string | undefined): number {
  const t = new Set(words(txt ?? "").map(stem));
  let k = 0;
  for (const w of qs) if (t.has(w)) k++;
  return k;
}
/** Offline: fiszka / „prościej” / „zapamiętaj” najbardziej podobne do pytania (legacy `explainFor`). */
export function offlineExplain(q: QuizQuestion, topic: Topic, level: Level): string {
  const qs = [...new Set(words(q.q + " " + (q.a[q.c] ?? "")).map(stem))];
  const lvls = [level, ...topic.levels.filter((l) => l !== level)];
  let card: { t: string; d: string } | null = null,
    cs = 0;
  let feed: { real?: string; mnemo?: string } | null = null,
    fs = 0;
  for (const l of lvls) {
    for (const c of l.flashcards) {
      const sc = overlap(qs, c.t) * 3 + overlap(qs, c.d);
      if (sc > cs) {
        cs = sc;
        card = c;
      }
    }
    for (const f of l.feed) {
      if (!f.real && !f.mnemo) continue;
      const sc = overlap(qs, f.title) * 3 + overlap(qs, f.body) + overlap(qs, f.real) + overlap(qs, f.mnemo);
      if (sc > fs) {
        fs = sc;
        feed = f;
      }
    }
  }
  const parts: string[] = [`Poprawna odpowiedź: ${q.a[q.c] ?? ""}.`];
  if (card) parts.push(`Fiszka: ${card.t} — ${fold(card.d) ? card.d.replace(/<[^>]+>/g, "") : card.d}`);
  if (feed?.real) parts.push(`Prościej: ${feed.real.replace(/<[^>]+>/g, "")}`);
  if (feed?.mnemo) parts.push(`Zapamiętaj: ${feed.mnemo.replace(/<[^>]+>/g, "")}`);
  if (!card && !feed) parts.push(q.e || "Zapamiętaj poprawną odpowiedź i wróć do fiszek z tego poziomu.");
  return parts.join("\n\n");
}

/** „Skąd to pytanie?” (SourceView.html): strona materiału (podgląd zdjęcia = wersja online), cytat, „Pytanie jest złe”. */
export function SourceSheet({ open, q, ctx, onClose, onEdit }: { open: boolean; q: QuizQuestion | undefined; ctx?: QCtx | null; onClose: () => void; onEdit?: () => void }) {
  const src = q?.src ?? {};
  const sub = [src.material ? "Twój materiał" : "materiał źródłowy", src.page ? `strona ${src.page}` : ""].filter(Boolean).join(" · ");
  return (
    <Sheet open={open} onClose={onClose} bg={T.surface2} tone="gold" top={150} handle={false}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <Display size={22} ls={-0.6}>
            Skąd to pytanie?
          </Display>
          <Muted size={12.5} style={{ marginTop: 3 }}>
            {sub}
          </Muted>
        </View>
        <RoundBtn icon="close" onPress={onClose} label="Zamknij" />
      </View>
      <Motion kind="up" d={1}>
        <View style={s.page}>
          <View style={s.paper}>
            <View style={[s.pl, { width: "55%", height: 10, backgroundColor: "#9E968A" }]} />
            {[92, 86, 95, 70, 90, 88].map((w, i) => (
              <View key={i} style={[s.pl, { width: `${w}%` }]} />
            ))}
            <Motion kind="glow">
              <View style={[s.pl, { width: "60%", height: 9, backgroundColor: T.gold }]} />
            </Motion>
            {[94, 80, 85, 76, 92].map((w, i) => (
              <View key={i} style={[s.pl, { width: `${w}%` }]} />
            ))}
          </View>
        </View>
      </Motion>
      <Motion kind="up" d={2}>
        <View style={[s.box, { backgroundColor: TONES.gold.tint, borderWidth: 2, borderColor: TONES.gold.tintLine }]}>
          <Eyebrow color={T.gold}>Zaznaczony fragment</Eyebrow>
          <Body size={14} weight={700} color={TONES.gold.txt} lh={21} style={{ marginTop: 6 }}>
            {src.quote ? `„${src.quote}”` : "Brak cytatu w danych — jest tylko odnośnik do materiału."}
          </Body>
        </View>
      </Motion>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {onEdit && ctx ? <Btn label="Pytanie jest złe" variant="ghost" small onPress={onEdit} style={{ width: 150 }} /> : null}
        <Btn label="Wracam" tone="gold" onPress={onClose} style={{ flex: 1 }} />
      </View>
    </Sheet>
  );
}

/** Koniec żyć (NoHearts.html): licznik, „Powtórz N fiszek” (+1 życie), „Uzupełnij wszystkie” (gemy), „Wróć później”. */
export function NoHeartsSheet({ open, onLeave, onResume, onCards }: { open: boolean; onLeave: () => void; onResume: () => void; onCards?: () => void }) {
  const app = useApp();
  const router = useRouter();
  const [, tickN] = useState(0);
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => tickN((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [open]);
  useEffect(() => {
    if (open && app.hearts.hearts > 0) {
      app.showToast("Życie wróciło", "heart");
      onResume();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, app.hearts.hearts]);
  const eta = app.hearts.nextInMs ?? 0;
  const gems = app.gems;
  const enough = gems >= HEART_REFILL_GEMS;
  return (
    <Sheet open={open} tone="red" bg={T.surface2} dismissable={false} handle={false}>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 10 }}>
        {Array.from({ length: HEARTS_MAX }, (_, i) => (
          <Icon key={i} name="heart" size={30} fill={false} stroke={2.2} color={T.red} />
        ))}
      </View>
      <View style={{ alignItems: "center" }}>
        <Motion kind="pop" d={1}>
          <Display size={30} color={TONES.red.txt} ls={-1}>
            Koniec żyć
          </Display>
        </Motion>
        <Body size={13.5} weight={600} color={TONES.red.sub} center lh={20} style={{ marginTop: 7 }}>
          Kolejne życie wraca za{" "}
          <Body size={13.5} weight={800} color={TONES.red.txt}>
            {eta ? formatCountdown(eta) : "chwilę"}
          </Body>
          . Możesz też odzyskać je od razu.
        </Body>
      </View>
      <Motion kind="glow">
        <Press
          onPress={() => {
            onLeave();
            if (onCards) onCards();
            else router.push("/(tabs)/cards");
            app.showToast("Przejrzyj 5 fiszek — wraca życie", "heart");
          }}
          drop={5}
          edge={TONES.acid.tintShadow}
          radius={22}
          faceStyle={[s.nhcard, { backgroundColor: TONES.acid.tint, borderColor: TONES.acid.tintLine }]}
        >
          <IconTile icon="refresh" size={46} tone="acid" stroke={2.8} />
          <View style={{ flex: 1 }}>
            <Body size={15} weight={800} color={TONES.acid.txt}>
              Powtórz 5 fiszek
            </Body>
            <Muted size={12.5} color={TONES.acid.sub} style={{ marginTop: 2 }}>
              odzyskujesz jedno życie · za darmo
            </Muted>
          </View>
          <Icon name="chevron-right" size={20} color={TONES.acid.sub} />
        </Press>
      </Motion>
      <Press
        onPress={() => {
          if (app.refillHearts()) onResume();
        }}
        drop={5}
        edge={TONES.cyan.tintShadow}
        radius={22}
        faceStyle={[s.nhcard, { backgroundColor: TONES.cyan.tint, borderColor: TONES.cyan.tintLine }]}
      >
        <IconTile icon="gem" size={46} tone="cyan" />
        <View style={{ flex: 1 }}>
          <Body size={15} weight={800} color={TONES.cyan.txt}>
            Uzupełnij wszystkie
          </Body>
          <Muted size={12.5} color={TONES.cyan.sub} style={{ marginTop: 2 }}>
            {HEART_REFILL_GEMS} gemów · {enough ? `zostanie ${gems - HEART_REFILL_GEMS}` : `masz ${gems} — brakuje ${HEART_REFILL_GEMS - gems}`}
          </Muted>
        </View>
        <Icon name="chevron-right" size={20} color={TONES.cyan.sub} />
      </Press>
      <Btn label="Wróć później" variant="text" onPress={onLeave} />
    </Sheet>
  );
}

/** Nazwa poziomu bez emoji + pomocnik dla arkuszy. */
export const levelTitle = (l: Level) => noEmoji(l.title);

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  ico: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  xpchip: { backgroundColor: T.gold, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 15 },
  box: { borderRadius: 16, paddingVertical: 13, paddingHorizontal: 15, gap: 2 },
  list: { borderRadius: 12, padding: 10, gap: 4, marginTop: 8 },
  ghostBtn: { height: 58, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  src: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  exbox: { backgroundColor: TONES.cyan.tint, borderWidth: 2, borderColor: TONES.cyan.tintLine, borderRadius: 22, padding: 17, minHeight: 80, justifyContent: "center" },
  page: { alignItems: "center", backgroundColor: "#1A1916", borderRadius: 22, padding: 18 },
  paper: { width: 290, borderRadius: 8, backgroundColor: "#EDE9DF", padding: 16, gap: 9 },
  pl: { height: 6, borderRadius: 3, backgroundColor: "#CFC8B8" },
  nhcard: { flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 2, padding: 15 },
});
