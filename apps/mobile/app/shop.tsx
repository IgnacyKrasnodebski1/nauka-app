import { BOOST_MS, FREEZE_MAX, GEM_SOURCES, HEARTS_MAX, SHOP_ITEMS, THEMES, boostLeftMs } from "@nauka/shared";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Icon } from "@/components/Icon";
import { Motion, type MotionKind } from "@/components/Motion";
import { Body, Eyebrow, Muted } from "@/components/Text";
import { Blob, ListCard, Pill, Press, Row, Screen, TopBar, Touch, useTop } from "@/components/ui";
import { useApp } from "@/lib/app-state";
import { etaText, fmtNum, npl } from "@/lib/format";
import { T, TONES } from "@/lib/theme";

const ANIM: Record<string, MotionKind> = { "a-sway": "sway", "a-beat": "beat", "a-pulse": "pulse" };
const SRC_ICON: Record<string, [string, string]> = { poziom: ["check", T.acid], skrzynia: ["chest", T.gold], misja: ["star", T.gold], plan: ["calendar", T.cyan], boss: ["boss", T.violet], serii: ["flame", T.flame], egzamin: ["trophy", T.gold] };

/** Plecak (Shop.html): zamrożenie serii, uzupełnienie serc, podwójne XP, motyw — ceny z `SHOP_ITEMS`; „Skąd brać gemy”. */
export default function Shop() {
  const app = useApp();
  const router = useRouter();
  const top = useTop();
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 15000);
    return () => clearInterval(id);
  }, []);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));
  const g = app.gems;
  const owned = app.extra.themes.owned;
  const info = (id: string): { sub: string; can: boolean } => {
    switch (id) {
      case "freeze": {
        const n = app.meta.streakFreezes;
        return { sub: n >= FREEZE_MAX ? `masz ${FREEZE_MAX} z ${FREEZE_MAX} — komplet` : `masz ${n} z ${FREEZE_MAX} — ratuje serię w wolny dzień`, can: n < FREEZE_MAX };
      }
      case "refill": {
        const h = app.hearts.hearts;
        return { sub: app.hearts.unlimited ? "w planie Pro życia są nieskończone" : h >= HEARTS_MAX ? `masz komplet ${HEARTS_MAX} z ${HEARTS_MAX}` : `masz ${h} z ${HEARTS_MAX} — wróć do nauki od razu`, can: !app.hearts.unlimited && h < HEARTS_MAX };
      }
      case "boost": {
        const left = boostLeftMs(app.extra.boostUntil);
        return { sub: left > 0 ? `aktywne jeszcze ${etaText(left)}` : `${Math.round(BOOST_MS / 60000)} minut · przydaje się przed sesją nauki`, can: left <= 0 };
      }
      default:
        return { sub: owned.length >= THEMES.length ? "wszystkie zestawy odblokowane" : `${owned.length} z ${THEMES.length} zestawów · kolor tła na ekranie Dziś`, can: owned.length < THEMES.length };
    }
  };
  const buy = (id: string, name: string, price: number) => {
    const { can } = info(id);
    if (!can) return app.showToast("Masz już komplet", "check");
    if (g < price) return app.showToast(`Brakuje ${npl(price - g, "gema", "gemów", "gemów")}`, "gem");
    let ok = false;
    let msg = "";
    if (id === "freeze") {
      ok = app.buyStreakFreeze();
      msg = "Zamrożenie w plecaku";
    } else if (id === "refill") {
      ok = app.refillHearts();
      msg = "Życia uzupełnione";
    } else if (id === "boost") {
      ok = app.buyBoost();
      msg = "Podwójne XP przez 15 minut";
    } else {
      ok = app.buyTheme();
      const nx = app.extra.themes.active;
      msg = "Nowy motyw: " + (THEMES.find((t) => t.id === nx)?.name ?? name);
    }
    if (ok) app.showToast(msg, id === "refill" ? "heart" : id === "boost" ? "bolt" : id === "theme" ? "palette" : "snow");
  };
  return (
    <Screen scroll pad={false} bottom={40} blob={<Blob tone="cyan2" size={270} top={-100} left={-90} />}>
      <View style={[s.wrap, { paddingTop: top }]}>
        <TopBar title="Plecak" onBack={back} right={<Motion kind="pop"><Pill kind="gems" value={fmtNum(g)} /></Motion>} />
        {SHOP_ITEMS.map((it, i) => {
          const set = TONES[it.tone];
          const { sub, can } = info(it.id);
          const afford = g >= it.price;
          return (
            <Motion key={it.id} kind="up" d={i + 1}>
              <View style={[s.row, { backgroundColor: set.tint, borderColor: set.tintLine, shadowColor: set.tintShadow }]}>
                <Motion kind={ANIM[it.anim] ?? "none"}>
                  <View style={[s.ico, { backgroundColor: set.color }]}>
                    <Icon name={it.icon} size={28} stroke={2.6} color={set.on} />
                  </View>
                </Motion>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Body size={15} weight={800} color={set.txt}>
                    {it.name}
                  </Body>
                  <Muted size={12.5} color={set.sub} style={{ marginTop: 3 }} lh={16}>
                    {sub}
                  </Muted>
                </View>
                <Press onPress={() => buy(it.id, it.name, it.price)} drop={4} edge={can ? (afford ? set.dark : T.shadow) : T.shadow} radius={14} faceStyle={[s.buy, can ? (afford ? { backgroundColor: set.color } : { backgroundColor: T.surface, borderWidth: 2, borderColor: T.line }) : { backgroundColor: T.surface, borderWidth: 2, borderColor: T.line }]} accessibilityLabel={can ? `Kup: ${it.name} za ${it.price} gemów` : `${it.name}: masz komplet`}>
                  {can ? (
                    <>
                      <Icon name="gem" size={14} color={afford ? set.on : T.muted} />
                      <Body size={13} weight={800} color={afford ? set.on : T.muted}>
                        {it.price}
                      </Body>
                    </>
                  ) : (
                    <Icon name="check" size={16} stroke={3.4} color={T.acid} />
                  )}
                </Press>
              </View>
              {it.id === "theme" && owned.length > 1 ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  {THEMES.filter((t) => owned.includes(t.id)).map((t) => {
                    const on = app.extra.themes.active === t.id;
                    const c = (TONES as Record<string, { color: string }>)[t.id]?.color ?? T.violet;
                    return (
                      <Touch key={t.id} onPress={() => { app.setTheme(t.id); app.showToast("Motyw: " + t.name, "palette"); }} accessibilityRole="button" accessibilityState={{ selected: on }} style={[s.chip, on && { borderColor: c }]}>
                        <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: c }} />
                        <Body size={12.5} weight={800} color={on ? T.txt : T.muted}>
                          {t.name}
                        </Body>
                      </Touch>
                    );
                  })}
                </View>
              ) : null}
            </Motion>
          );
        })}
        <Eyebrow style={{ marginTop: 4 }}>Skąd brać gemy</Eyebrow>
        <Motion kind="up" d={5}>
          <ListCard>
            {GEM_SOURCES.map((src) => {
              const m = Object.entries(SRC_ICON).find(([k]) => src.label.toLowerCase().includes(k));
              return <Row key={src.label} icon={m?.[1][0] ?? "gem"} iconColor={m?.[1][1] ?? T.cyan} title={src.label} value={`+${src.gems}`} valueColor="#7EE8FA" />;
            })}
          </ListCard>
        </Motion>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 18, gap: 13 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 2, borderRadius: 24, padding: 15, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 5 } },
  ico: { width: 52, height: 52, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  buy: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 11, paddingHorizontal: 14, minWidth: 54, justifyContent: "center" },
  chip: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: T.surface, borderWidth: 2, borderColor: T.line, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
});
