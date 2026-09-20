import { ACHIEVEMENTS, RANKS, achievementByKey, type Achievement, type LeaderboardRow, type Quest, type Rank } from "@nauka/shared";
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { COLORS, PLAY, RADIUS, SPACE, display, tabular, withAlpha } from "@/lib/theme";
import { Button3D } from "./Button3D";
import { ACHIEVEMENT_ICON, Icon, QUEST_ICON } from "./Icon";
import { GemIcon } from "./Pills";
import { Body, Display, Label, Muted, Num, Title } from "./Text";
import { Card, Touch } from "./ui";

/* ------------------------------------------------------------- questy */

/** Karta questów: 3 wiersze (ikona, tytuł, pasek, nagroda), „Odbierz” 3D gdy done. */
export function QuestsCard({ quests, onClaim, style }: { quests: Quest[]; onClaim: (id: string) => void; style?: StyleProp<ViewStyle> }) {
  const done = quests.filter((q) => q.done).length;
  return (
    <Card style={[{ padding: SPACE[4], gap: SPACE[3] }, style]}>
      <View style={s.head}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={[s.iconBox, { backgroundColor: PLAY.purpleSoft }]}>
            <Icon name="rocket" size={18} color={PLAY.purple} />
          </View>
          <Title size="md">Misje dnia</Title>
        </View>
        <Muted size="xs" weight={700} style={tabular}>
          {done}/{quests.length}
        </Muted>
      </View>
      {quests.map((q, i) => (
        <QuestRow key={q.id} q={q} onClaim={() => onClaim(q.id)} last={i === quests.length - 1} />
      ))}
    </Card>
  );
}

function QuestRow({ q, onClaim, last }: { q: Quest; onClaim: () => void; last: boolean }) {
  const pct = Math.min(100, Math.round((q.progress / q.target) * 100));
  const claimable = q.done && !q.claimed;
  const color = q.claimed ? COLORS.faint : q.done ? PLAY.green : PLAY.blue;
  return (
    <View style={[s.qrow, !last && s.hair]}>
      <View style={[s.iconBox, { backgroundColor: withAlpha(color, 0.18) }]}>
        <Icon name={q.claimed ? "checkmark-done" : (QUEST_ICON[q.kind] ?? "flash")} size={18} color={color} />
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
          <Body weight={700} color={q.claimed ? COLORS.muted : COLORS.text} numberOfLines={1} style={{ flex: 1 }}>
            {q.title}
          </Body>
          <Muted size="xs" weight={700} style={tabular}>
            {Math.min(q.progress, q.target)}/{q.target}
          </Muted>
        </View>
        <View style={s.bar}>
          <View style={[s.barFill, { width: `${pct}%`, backgroundColor: color }]} />
        </View>
      </View>
      {claimable ? (
        <Button3D label="Odbierz" size="sm" variant="gold" onPress={onClaim} style={{ alignSelf: "center", width: 96 }} />
      ) : (
        <View style={[s.reward, q.claimed && { opacity: 0.5 }]}>
          <GemIcon size={14} color={q.claimed ? COLORS.faint : PLAY.gem} />
          <Muted size="xs" weight={700} color={q.claimed ? COLORS.faint : PLAY.gem} style={tabular}>
            +{q.reward}
          </Muted>
        </View>
      )}
    </View>
  );
}

/* ------------------------------------------------------------- ranking */

const MEDAL = [PLAY.yellow, "#C0C7D6", "#C98A1E"];

/** Podium top 3 + lista + Twój wiersz. `compact` = zajawka na Home. */
export function Leaderboard({ rows, me, compact, style }: { rows: LeaderboardRow[]; me?: { rank: number; xp: number; total: number } | null; compact?: boolean; style?: StyleProp<ViewStyle> }) {
  const top = rows.slice(0, 3);
  const rest = compact ? [] : rows.slice(3);
  const meRow = rows.find((r) => r.isMe);
  const order = [top[1], top[0], top[2]];
  return (
    <View style={[{ gap: SPACE[3] }, style]}>
      {top.length ? (
        <View style={s.podium}>
          {order.map((r, k) =>
            r ? (
              <PodiumSpot key={r.rank + r.displayName} row={r} place={k === 1 ? 1 : k === 0 ? 2 : 3} compact={compact} />
            ) : (
              <View key={`e${k}`} style={{ flex: 1 }} />
            ),
          )}
        </View>
      ) : (
        <Muted center style={{ paddingVertical: SPACE[4] }}>
          Jeszcze pusto w tym tygodniu — zdobądź pierwsze XP.
        </Muted>
      )}
      {rest.length ? (
        <Card style={{ padding: 0, paddingHorizontal: SPACE[4] }}>
          {rest.map((r, i) => (
            <View key={r.rank + r.displayName} style={[s.lrow, i < rest.length - 1 && s.hair, r.isMe && { backgroundColor: PLAY.greenSoft, marginHorizontal: -SPACE[4], paddingHorizontal: SPACE[4] }]}>
              <Num size="base" weight={700} color={COLORS.muted} style={{ width: 30 }}>
                {r.rank}
              </Num>
              <View style={[s.avatar, { backgroundColor: avatarColor(r.displayName) }]}>
                <Display size="sm" weight={800} color="#fff">
                  {r.displayName.slice(0, 1).toUpperCase()}
                </Display>
              </View>
              <Body weight={700} color={r.isMe ? PLAY.green : COLORS.text} numberOfLines={1} style={{ flex: 1 }}>
                {r.isMe ? `${r.displayName} (Ty)` : r.displayName}
              </Body>
              <Num size="base" weight={700} color={COLORS.xp}>
                {r.xp} XP
              </Num>
            </View>
          ))}
        </Card>
      ) : null}
      {me && !meRow?.isMe ? (
        <View style={s.meRow}>
          <Num size="base" weight={700} color={PLAY.green} style={{ width: 30 }}>
            {me.rank}
          </Num>
          <Body weight={700} color={PLAY.green} style={{ flex: 1 }}>
            Ty
          </Body>
          <Num size="base" weight={700} color={COLORS.xp}>
            {me.xp} XP
          </Num>
        </View>
      ) : null}
    </View>
  );
}

function PodiumSpot({ row, place, compact }: { row: LeaderboardRow; place: 1 | 2 | 3; compact?: boolean }) {
  const h = compact ? [64, 48, 40][place - 1]! : [96, 72, 56][place - 1]!;
  const color = MEDAL[place - 1]!;
  return (
    <Animated.View entering={FadeInDown.delay(place * 80).duration(300)} style={{ flex: 1, alignItems: "center", gap: 6 }}>
      <View style={[s.avatar, { width: place === 1 ? 48 : 40, height: place === 1 ? 48 : 40, borderRadius: 24, backgroundColor: avatarColor(row.displayName), borderWidth: 3, borderColor: color }]}>
        <Display size="md" weight={800} color="#fff">
          {row.displayName.slice(0, 1).toUpperCase()}
        </Display>
      </View>
      <Body size="sm" weight={700} color={row.isMe ? PLAY.green : COLORS.text} numberOfLines={1}>
        {row.isMe ? "Ty" : row.displayName}
      </Body>
      <View style={[s.pod, { height: h, backgroundColor: withAlpha(color, 0.22), borderColor: withAlpha(color, 0.5) }]}>
        <Display size="lg" weight={800} color={color}>
          {place}
        </Display>
        <Muted size="xs" weight={700} color={COLORS.xp} style={tabular}>
          {row.xp} XP
        </Muted>
      </View>
    </Animated.View>
  );
}

function avatarColor(name: string): string {
  const pal = [PLAY.purple, PLAY.blue, PLAY.orange, PLAY.pink, PLAY.green, "#A66BFF", "#2EE6A6", "#FF7A5C"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return pal[Math.abs(h) % pal.length]!;
}

/* ------------------------------------------------------------- odznaki */

/** Siatka odznak 4 kolumny; zablokowane szare z „?”. */
export function BadgesGrid({ unlocked, onPress, style }: { unlocked: ReadonlySet<string>; onPress?: (a: Achievement) => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.badges, style]}>
      {ACHIEVEMENTS.map((a) => {
        const on = unlocked.has(a.key);
        return (
          <Touch key={a.key} onPress={() => onPress?.(a)} style={s.badge}>
            <View style={[s.badgeTile, on ? { backgroundColor: PLAY.yellow, borderBottomColor: PLAY.yellowDeep } : { backgroundColor: COLORS.bg3, borderBottomColor: PLAY.surfaceDeep }]}>
              {on ? <Icon name={ACHIEVEMENT_ICON[a.icon] ?? "star"} size={26} color="#7A4E0A" /> : <Icon name="help" size={24} color={COLORS.faint} />}
            </View>
            <Muted size="xs" weight={600} center numberOfLines={2} color={on ? COLORS.text : COLORS.faint} style={{ lineHeight: 14 }}>
              {a.title}
            </Muted>
          </Touch>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------- ranga */

/** Karta rangi: nazwa + kolor, pasek do następnej, ile XP brakuje. */
export function RankCard({ rank, totalXp, name, sub, style }: { rank: Rank; totalXp: number; name: string; sub?: string; style?: StyleProp<ViewStyle> }) {
  const nextName = RANKS[rank.tier + 1]?.name;
  return (
    <View style={[s.rank, { borderColor: withAlpha(rank.color, 0.45) }, style]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(rank.color, 0.1) }]} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE[3] }}>
        <View style={[s.rankBadge, { backgroundColor: rank.color, borderBottomColor: withAlpha("#000000", 0.35) }]}>
          <Icon name="shield-checkmark" size={26} color="#fff" />
          <Display size="xs" weight={800} color="#fff" style={{ fontSize: 11 }}>
            {rank.tier + 1}
          </Display>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Display size="xl" weight={800} numberOfLines={1}>
            {name}
          </Display>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Body weight={700} color={rank.color}>
              {rank.name}
            </Body>
            {sub ? (
              <Muted size="xs" numberOfLines={1} style={{ flexShrink: 1 }}>
                · {sub}
              </Muted>
            ) : null}
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Num size="lg" weight={800} color={COLORS.xp}>
            {totalXp}
          </Num>
          <Label>xp</Label>
        </View>
      </View>
      <View style={{ gap: 6, marginTop: SPACE[3] }}>
        <View style={[s.bar, { height: 10 }]}>
          <View style={[s.barFill, { width: `${rank.pct}%`, backgroundColor: rank.color }]} />
        </View>
        <Muted size="xs" weight={600} style={tabular}>
          {rank.next ? `${rank.next - totalXp} XP do rangi ${nextName}` : "Najwyższa ranga — legenda Recall"}
        </Muted>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------- kalendarz serii */

/** Pasek serii 7 dni (Pn–Nd): dni z XP = płomień, dziś = ring, przyszłe = wygaszone. */
export function StreakCalendar({ week, streak, style }: { week: { day: string; label: string; xp: number; active: boolean; isToday: boolean; future: boolean }[]; streak: number; style?: StyleProp<ViewStyle> }) {
  return (
    <Card style={[{ padding: SPACE[4], gap: SPACE[3] }, style]}>
      <View style={s.head}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={[s.iconBox, { backgroundColor: PLAY.orangeSoft }]}>
            <Icon name="flame" size={18} color={PLAY.orange} />
          </View>
          <Title size="md">Seria</Title>
        </View>
        <Num size="base" weight={800} color={PLAY.orange}>
          {streak} {streak === 1 ? "dzień" : "dni"}
        </Num>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {week.map((d) => (
          <View key={d.day} style={{ alignItems: "center", gap: 6, flex: 1 }}>
            <Muted size="xs" weight={700} color={d.isToday ? PLAY.orange : COLORS.muted}>
              {d.label}
            </Muted>
            <View style={[s.dayDot, d.active && { backgroundColor: PLAY.orange, borderColor: PLAY.orange }, d.isToday && !d.active && { borderColor: PLAY.orange, borderStyle: "dashed" }, d.future && { opacity: 0.35 }]}>
              {d.active ? <Icon name="flame" size={16} color="#fff" /> : d.isToday ? <Icon name="ellipse-outline" size={10} color={PLAY.orange} /> : null}
            </View>
            <Muted size="xs" style={[tabular, { fontSize: 10 }]}>
              {d.xp ? d.xp : "·"}
            </Muted>
          </View>
        ))}
      </View>
    </Card>
  );
}

export { achievementByKey };

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconBox: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  qrow: { flexDirection: "row", alignItems: "center", gap: SPACE[3], paddingVertical: SPACE[2] },
  hair: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.lineStrong },
  bar: { height: 8, backgroundColor: COLORS.bg3, borderRadius: 999, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 999 },
  reward: { flexDirection: "row", alignItems: "center", gap: 3, minWidth: 44, justifyContent: "flex-end" },
  podium: { flexDirection: "row", alignItems: "flex-end", gap: SPACE[2], paddingTop: SPACE[2] },
  pod: { alignSelf: "stretch", borderTopLeftRadius: RADIUS.sm, borderTopRightRadius: RADIUS.sm, borderWidth: 1, borderBottomWidth: 0, alignItems: "center", justifyContent: "center", gap: 2 },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  lrow: { flexDirection: "row", alignItems: "center", gap: SPACE[3], paddingVertical: SPACE[3] },
  meRow: { flexDirection: "row", alignItems: "center", gap: SPACE[3], padding: SPACE[3], paddingHorizontal: SPACE[4], backgroundColor: PLAY.greenSoft, borderWidth: 1, borderColor: PLAY.green, borderRadius: RADIUS.md },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: SPACE[2] },
  badge: { width: "23%", flexGrow: 1, alignItems: "center", gap: 6 },
  badgeTile: { width: 62, height: 62, borderRadius: 18, alignItems: "center", justifyContent: "center", borderBottomWidth: 4 },
  rank: { borderWidth: 1.5, borderRadius: RADIUS.lg, padding: SPACE[4], overflow: "hidden", backgroundColor: COLORS.bg2 },
  rankBadge: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", borderBottomWidth: 4 },
  dayDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.bg3, borderWidth: 2, borderColor: COLORS.line, alignItems: "center", justifyContent: "center" },
  _d: { fontFamily: display(700) },
});
