import { isLevelUnlocked, levelProgress, type SubjectProgress } from "@nauka/shared";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { AppSubject } from "@/lib/subjects";
import { C, FONT } from "@/lib/theme";
import { AccentGradient, useAccent } from "./Accent";
import { Touch } from "./ui";

/** Ścieżka poziomów w stylu Duolingo (zygzak, kółka: done / open / lock, gwiazdki). */
export function LevelPath({ subject, progress, onOpen, onLocked }: { subject: AppSubject; progress: SubjectProgress; onOpen: (levelId: string) => void; onLocked: () => void }) {
  const a = useAccent();
  return (
    <View style={s.path}>
      {subject.levels.map((lv, i) => {
        const lp = levelProgress(progress, lv.id);
        const unlocked = isLevelUnlocked(subject, progress, lv.id);
        const prevDone = i > 0 && levelProgress(progress, subject.levels[i - 1]!.id).done;
        const shift = i % 2 === 0 ? -46 : 46;
        return (
          <React.Fragment key={lv.id}>
            {i > 0 ? <View style={[s.connector, prevDone && { backgroundColor: a.solid }]} /> : null}
            <View style={[s.node, { transform: [{ translateX: shift }] }]}>
              <Touch onPress={unlocked ? () => onOpen(lv.id) : onLocked} style={s.btnWrap} accessibilityLabel={lv.title}>
                {lp.done ? (
                  <AccentGradient style={s.btn}>
                    <Text style={s.btnTxt}>✓</Text>
                  </AccentGradient>
                ) : unlocked ? (
                  <View style={[s.btn, s.open, { borderColor: a.solid }]}>
                    <Text style={s.btnTxt}>{lv.emoji || "📘"}</Text>
                  </View>
                ) : (
                  <View style={[s.btn, s.lock]}>
                    <Text style={[s.btnTxt, { opacity: 0.5 }]}>🔒</Text>
                  </View>
                )}
                {lp.done ? (
                  <Text style={s.stars}>
                    {"⭐".repeat(lp.stars)}
                    <Text style={{ color: C.muted }}>{"·".repeat(Math.max(0, 3 - lp.stars))}</Text>
                  </Text>
                ) : null}
              </Touch>
              <Text style={s.label} numberOfLines={2}>
                {lv.title}
              </Text>
              <Text style={s.small}>
                {lv.quiz.length} pytań · {lv.flashcards.length} fiszek
              </Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  path: { alignItems: "center", gap: 6, paddingVertical: 14 },
  node: { alignItems: "center", gap: 6, width: 200 },
  btnWrap: { alignItems: "center" },
  btn: { width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 0, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  open: { backgroundColor: "#2c2c48", borderWidth: 2 },
  lock: { backgroundColor: "#1a1a28" },
  btnTxt: { fontSize: 34, color: "#fff", fontWeight: FONT.black },
  stars: { marginTop: -10, fontSize: 13, color: C.txt, textShadowColor: "#000", textShadowRadius: 2 },
  label: { color: C.txt, fontSize: 13.5, fontWeight: FONT.bold, textAlign: "center", maxWidth: 180, marginTop: 4 },
  small: { color: C.muted, fontSize: 11.5, fontWeight: FONT.semi },
  connector: { width: 4, height: 26, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 2 },
});
