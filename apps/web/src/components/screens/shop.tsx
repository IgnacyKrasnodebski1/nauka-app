"use client";
import { boostLeftMs, FREEZE_MAX, GEM_SOURCES, HEARTS_MAX, pl, SHOP_ITEMS, THEMES } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { etaText } from "@/lib/dates";
import { Shell, GemPill } from "@/components/app/chrome";
import { Icon } from "@/components/ui/icons";
import { useSfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";

const SRC_ICON: Record<string, [string, string]> = { "zaliczony poziom": ["check", "ic-acid"], "poziom na 3 gwiazdki": ["star", "ic-gold"], "skrzynia na ścieżce": ["chest", "ic-gold"], "misja dzienna": ["star", "ic-gold"], "misja tygodniowa": ["trophy", "ic-gold"], "cały plan dnia": ["calendar", "ic-cyan"], "boss rozdziału": ["boss", "ic-violet"] };

/** Shop.html — Plecak: streak freeze, hearts refill, double XP, theme (+ owned theme chips), where gems come from. */
export function ShopScreen() {
  const { gems, meta, hearts, unlimitedHearts, boostUntil, boostOn, buyStreakFreeze, refillHearts, buyBoost, buyTheme, themes, setTheme, toast } = useApp();
  const sfx = useSfx();
  const sub = (id: string) => {
    if (id === "freeze") return meta.streakFreezes >= FREEZE_MAX ? `masz ${FREEZE_MAX} z ${FREEZE_MAX} — komplet` : `masz ${meta.streakFreezes} z ${FREEZE_MAX} — ratuje serię w wolny dzień`;
    if (id === "refill") return unlimitedHearts ? "Pro — życia bez limitu" : hearts.hearts >= HEARTS_MAX ? `masz komplet ${HEARTS_MAX} z ${HEARTS_MAX}` : `masz ${hearts.hearts} z ${HEARTS_MAX} — wróć do nauki od razu`;
    if (id === "boost") return boostOn ? `aktywne jeszcze ${etaText(boostLeftMs(boostUntil))}` : "przydaje się przed sesją nauki";
    return themes.owned.length >= THEMES.length ? "wszystkie zestawy odblokowane" : `${themes.owned.length} z ${THEMES.length} zestawów · kolor tła na ekranie Dziś`;
  };
  const can = (id: string) => (id === "freeze" ? meta.streakFreezes < FREEZE_MAX : id === "refill" ? !unlimitedHearts && hearts.hearts < HEARTS_MAX : id === "boost" ? !boostOn : themes.owned.length < THEMES.length);
  const buy = (id: string, name: string, price: number, icon: string) => {
    if (!can(id)) return toast("Masz już komplet", "check");
    if (gems < price) { const br = price - gems; return toast(`Brakuje ${br} ${pl(br, "gema", "gemów", "gemów")}`, "gem"); }
    let msg: string | null = null;
    if (id === "freeze") msg = buyStreakFreeze() ? "Zamrożenie w plecaku" : null;
    else if (id === "refill") msg = refillHearts() ? "Życia uzupełnione" : null;
    else if (id === "boost") msg = buyBoost() ? "Podwójne XP przez 15 minut" : null;
    else { const n = buyTheme(); msg = n ? "Nowy motyw: " + n : null; }
    if (msg) { sfx.play("chest"); toast(msg, icon === "heart" ? "heart" : icon, "a-pop"); } else toast("Nie udało się kupić: " + name, "alert");
  };
  return (
    <Shell title="Plecak" backHref="/app" pills={false} blob="cyan" cls="shop" right={<GemPill cls="a-pop" />}>
      {SHOP_ITEMS.map((it, i) => {
        const c = can(it.id), afford = gems >= it.price;
        return (
          <div key={it.id} className="contents">
            <div className={cn("shoprow", it.tone, "a-up", "d" + (i + 1))} id={"shop-" + it.id}>
              <div className={cn("ico", it.anim)}><Icon name={it.icon} size={28} stroke={2.6} /></div>
              <div className="grow"><div className="t">{it.name}</div><div className="s">{sub(it.id)}</div></div>
              <button type="button" className={cn("buy", c ? (afford ? "" : "short") : "owned")} aria-label={c ? `Kup: ${it.name} za ${it.price} gemów` : it.name + ": masz komplet"} onClick={() => buy(it.id, it.name, it.price, it.icon)}>{c ? <><Icon name="gem" size={14} /><span>{it.price}</span></> : <Icon name="check" size={16} stroke={3.4} />}</button>
            </div>
            {it.id === "theme" && themes.owned.length > 1 && (
              <div className="themechips a-up d5">
                {THEMES.filter((t) => themes.owned.includes(t.id)).map((t) => (
                  <button key={t.id} type="button" className={cn("themechip", t.id === themes.active && "on")} style={{ "--sw": `var(--${t.id})` } as React.CSSProperties} aria-pressed={t.id === themes.active} onClick={() => { setTheme(t.id); toast("Motyw: " + t.name, "palette"); }}><i />{t.name}</button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div className="eyebrow sec">Skąd brać gemy</div>
      <div className="setcard a-up d5">
        {GEM_SOURCES.map((s, i) => { const [ic, cls] = SRC_ICON[s.label] ?? ["gem", "ic-cyan"]; return <div key={s.label} className="contents">{i > 0 && <div className="setsep" />}<div className="setrow"><Icon name={ic} size={18} stroke={2.8} className={cls} /><span className="t grow">{s.label[0]!.toUpperCase() + s.label.slice(1)}</span><span className="v cyan">+{s.gems}</span></div></div>; })}
      </div>
    </Shell>
  );
}
