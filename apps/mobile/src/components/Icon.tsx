import React, { useMemo } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { T } from "@/lib/theme";

/**
 * Ikony 2.0 — port `ICONS` z legacy/engine.js (te same nazwy, te same ścieżki, viewBox 24×24, stroke 2.4–3.4).
 * Zero emoji w chrome; emoji z danych zastępuje `Mono` (monogram) w ui.tsx.
 */
interface Def {
  d: string;
  w?: number;
  fill?: boolean;
}

export const ICONS: Record<string, Def> = {
  back: { d: "M15 5l-7 7 7 7", w: 3 },
  close: { d: "M6 6l12 12M18 6L6 18", w: 3 },
  check: { d: "M5 13l4.5 4.5L19 7", w: 3.4 },
  lock: { d: '<rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>' },
  bolt: { d: "M13 2L4 14h6l-1 8 9-12h-6z", fill: true },
  flame: { d: "M12 2c2.6 3.6 1.1 5.7 0 6.8C10.4 7.2 9 5.6 9 3.5 6.4 5.6 5 8.6 5 12a7 7 0 0 0 14 0c0-3.1-1.6-6.6-7-10z", fill: true },
  gem: { d: "M12 2l7 6-7 14-7-14z", fill: true },
  heart: { d: "M12 20.5S4 15.6 4 10.4A4.4 4.4 0 0 1 12 7.9a4.4 4.4 0 0 1 8 2.5c0 5.2-8 10.1-8 10.1z", fill: true },
  star: { d: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z", fill: true },
  book: { d: "M4 4h5a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-5a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h6z" },
  cards: { d: '<rect x="3" y="6" width="14" height="13" rx="3"/><path d="M8 3h10a3 3 0 0 1 3 3v10"/>' },
  brain: { d: "M11 4.5A3 3 0 0 0 5.5 7a3 3 0 0 0-1.4 5 3 3 0 0 0 1.4 5.3A3 3 0 0 0 11 19zM13 4.5A3 3 0 0 1 18.5 7a3 3 0 0 1 1.4 5 3 3 0 0 1-1.4 5.3A3 3 0 0 1 13 19zM11 4.5V19M13 4.5V19", w: 2.4 },
  target: { d: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>' },
  info: { d: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.5"/>' },
  list: { d: "M4 6h16M4 12h16M4 18h10" },
  clock: { d: '<circle cx="12" cy="12" r="9"/><path d="M12 6.5V12l4 2.5"/>' },
  "chevron-right": { d: "M9 5l7 7-7 7" },
  plus: { d: "M12 5v14M5 12h14", w: 3 },
  refresh: { d: "M4 12a8 8 0 1 1 2.5 5.8M4 12V7M4 12h5" },
  trophy: { d: "M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M9 20h6", w: 2.4 },
  chest: { d: '<rect x="3" y="9" width="18" height="11" rx="2.5"/><path d="M3 13h18M12 9v11M7 9V7a5 5 0 0 1 5 2 5 5 0 0 1 5-2v2"/>', w: 2.4 },
  home: { d: "M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z", w: 2.4 },
  calendar: { d: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>', w: 2.4 },
  settings: { d: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v2.2M12 18.8V21M21 12h-2.2M5.2 12H3M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6M18.4 18.4l-1.6-1.6M7.2 7.2L5.6 5.6"/>', w: 2.4 },
  user: { d: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>', w: 2.4 },
  search: { d: '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/>' },
  "x-circle": { d: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>' },
  alert: { d: "M12 8v5M12 16.5v.5M12 3l9 17H3z", w: 2.8 },
  bulb: { d: "M12 3a6 6 0 0 0-3 11v3h6v-3a6 6 0 0 0-3-11zM9.5 21h5" },
  bookmark: { d: "M5 5h14v14l-7-4-7 4z" },
  file: { d: "M6 4h9l4 4v12H6zM14 4v5h5" },
  question: { d: "M9.2 9a3 3 0 1 1 4 2.8c-.8.3-1.2 1-1.2 1.8v.4M12 17.5v.5", w: 3 },
  edit: { d: "M4 20h4L19 9l-4-4L4 16zM13 7l4 4" },
  link: { d: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5" },
  map: { d: "M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14", w: 2.4 },
  grid: { d: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>', w: 2.4 },
  flag: { d: "M5 21V4M5 4h12l-2 4 2 4H5" },
  upload: { d: "M12 16V4M8 8l4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3", w: 2.4 },
  "arrow-up": { d: "M12 19V5M6 11l6-6 6 6" },
  "chevron-up": { d: "M5 15l7-7 7 7", w: 3 },
  "chevron-down": { d: "M5 9l7 7 7-7", w: 3 },
  grip: { d: "M8 9h8M8 15h8" },
  quote: { d: "M4 18v-5c0-4 2-7 6-8l1 2c-2 1-3 3-3 5h3v6zm9 0v-5c0-4 2-7 6-8l1 2c-2 1-3 3-3 5h3v6z", fill: true },
  "arrow-down": { d: "M12 4v16M6 14l6 6 6-6", w: 3 },
  chart: { d: "M5 20v-8M11 20V5M17 20v-5M3 20h18", w: 2.8 },
  calc: { d: '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 7.5h6M9 12h.5M12 12h.5M15 12h.5M9 16h.5M12 16h.5M15 16h.5"/>', w: 2.4 },
  keyboard: { d: '<rect x="3" y="6" width="18" height="12" rx="3"/><path d="M7 10h.5M11 10h.5M15 10h.5M8 14h8"/>', w: 2.4 },
  swipe: { d: "M3 12h18M8 7l-5 5 5 5M16 7l5 5-5 5", w: 2.8 },
  pointer: { d: "M9 11V5.5a1.5 1.5 0 0 1 3 0V11l4 .8a3 3 0 0 1 2.4 3l-.5 3.3A3.5 3.5 0 0 1 14.4 21H12a4 4 0 0 1-3-1.4L5.4 15a1.6 1.6 0 0 1 2.4-2.1L9 14", w: 2.4 },
  camera: { d: '<rect x="3" y="7" width="18" height="13" rx="3"/><circle cx="12" cy="13.5" r="3.5"/><path d="M9 7l1.5-3h3L15 7"/>', w: 2.4 },
  wifi: { d: "M2 8.5a16 16 0 0 1 20 0M5.5 12.5a11 11 0 0 1 13 0M9 16.5a6 6 0 0 1 6 0M12 20v.5" },
  snow: { d: "M12 3v18M3 12h18M6 6l12 12M18 6L6 18", w: 2.6 },
  palette: { d: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17M3.5 12h17"/>', w: 2.4 },
  boss: { d: '<path d="M12 2l8.7 5v10L12 22l-8.7-5V7z"/><circle cx="9" cy="11.5" r="1.9" data-eye/><circle cx="15" cy="11.5" r="1.9" data-eye/><path d="M9 16.5q3 2.2 6 0" data-mouth/>', fill: true },
  ghost: { d: '<path d="M5 20V11a7 7 0 0 1 14 0v9l-2.3-1.6L14.3 20 12 18.4 9.7 20 7.3 18.4z"/><circle cx="9.5" cy="11" r="1.5" data-eye/><circle cx="14.5" cy="11" r="1.5" data-eye/>', fill: true },
  cap: { d: "M2 9l10-4 10 4-10 4zM6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5M22 9v5", w: 2.4 },
  globe: { d: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>', w: 2.4 },
  moon: { d: "M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z", fill: true },
  bell: { d: "M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 21h4", w: 2.4 },
  download: { d: "M12 4v12M8 12l4 4 4-4M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2", w: 2.4 },
  users: { d: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2.2.6 3.5 2.3 3.5 5.2"/>', w: 2.4 },
  share: { d: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.6M8.2 13.2l7.6 4.6"/>', w: 2.4 },
  trend: { d: "M3 17l6-6 4 4 8-8M15 7h6v6", w: 2.8 },
  /* dodatkowe (arkusz „Dodaj materiał”, ustawienia, logowanie) */
  mail: { d: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 8l9 6 9-6"/>', w: 2.4 },
  key: { d: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M15 12v2"/>', w: 2.4 },
  logout: { d: "M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l5 4-5 4M9 12h11", w: 2.4 },
  "volume": { d: "M4 10v4h4l5 4V6L8 10zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11", w: 2.4 },
  "volume-off": { d: "M4 10v4h4l5 4V6L8 10zM17 9l4 6M21 9l-4 6", w: 2.4 },
  sun: { d: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>', w: 2.4 },
  trash: { d: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6", w: 2.4 },
  sparkles: { d: "M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM5 17l.8 2.2L8 20l-2.2.8L5 23l-.8-2.2L2 20l2.2-.8zM19 15l.6 1.6 1.6.6-1.6.6L19 19.4l-.6-1.6-1.6-.6 1.6-.6z", fill: true },
  layers: { d: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5", w: 2.4 },
  gift: { d: '<rect x="3" y="9" width="18" height="12" rx="2"/><path d="M12 9v12M3 14h18M12 9c-3 0-5-1.5-5-3.5S9 3 12 6c3-3 5-1.5 5 .5S15 9 12 9z"/>', w: 2.4 },
  eye: { d: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', w: 2.4 },
  mic: { d: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/>', w: 2.4 },
};

/** Odznaki (`ACHIEVEMENTS[].icon`) i inne nazwy spoza zestawu → fallback jak legacy `ACH_ICON`. */
const ALIAS: Record<string, string> = { zap: "bolt", sparkles: "sparkles", layers: "layers", gift: "gift", sun: "sun", moon: "moon", diamond: "gem" };

type Node = { tag: "path"; d: string } | { tag: "circle"; cx: number; cy: number; r: number; eye?: boolean } | { tag: "rect"; x: number; y: number; width: number; height: number; rx?: number };

const cache = new Map<string, Node[]>();
function parse(name: string, def: Def): Node[] {
  const hit = cache.get(name);
  if (hit) return hit;
  const out: Node[] = [];
  if (!def.d.includes("<")) out.push({ tag: "path", d: def.d });
  else {
    const re = /<(path|circle|rect)([^>]*)\/?>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(def.d))) {
      const attrs: Record<string, string> = {};
      const ar = /([a-z-]+)="([^"]*)"/g;
      let a: RegExpExecArray | null;
      while ((a = ar.exec(m[2]!))) attrs[a[1]!] = a[2]!;
      if (m[1] === "path") out.push({ tag: "path", d: attrs.d ?? "" });
      else if (m[1] === "circle") out.push({ tag: "circle", cx: +(attrs.cx ?? 0), cy: +(attrs.cy ?? 0), r: +(attrs.r ?? 0), eye: /data-eye/.test(m[2]!) });
      else out.push({ tag: "rect", x: +(attrs.x ?? 0), y: +(attrs.y ?? 0), width: +(attrs.width ?? 0), height: +(attrs.height ?? 0), rx: attrs.rx ? +attrs.rx : undefined });
    }
  }
  cache.set(name, out);
  return out;
}

export type IconName = keyof typeof ICONS | (string & {});

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  /** grubość kreski (domyślnie z definicji, 2.6) */
  stroke?: number;
  /** wymuś pełny glif / kontur (np. gwiazdka niezdobyta) */
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
  /** kolor „oczu/ust” pełnych glifów (boss, duch) */
  inner?: string;
}

export function hasIcon(name: string): boolean {
  return !!ICONS[name] || !!ICONS[ALIAS[name] ?? ""];
}

export function Icon({ name, size = 20, color = T.txt, stroke, fill, style, inner }: IconProps) {
  const key = ICONS[name] ? name : (ALIAS[name] ?? "alert");
  const def = ICONS[key] ?? ICONS.alert!;
  const nodes = useMemo(() => parse(key, def), [key, def]);
  const filled = fill != null ? fill : !!def.fill;
  const sw = stroke ?? def.w ?? 2.6;
  const paint = filled ? { fill: color, stroke: "none" as const } : { fill: "none" as const, stroke: color, strokeWidth: sw, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style} accessible={false}>
      {nodes.map((n, i) => {
        if (n.tag === "path") {
          const isMouth = filled && key === "boss" && i === nodes.length - 1;
          return isMouth ? <Path key={i} d={n.d} fill="none" stroke={inner ?? T.bg} strokeWidth={2} strokeLinecap="round" /> : <Path key={i} d={n.d} {...paint} />;
        }
        if (n.tag === "circle") return <Circle key={i} cx={n.cx} cy={n.cy} r={n.r} {...(n.eye && filled ? { fill: inner ?? T.bg } : paint)} />;
        return <Rect key={i} x={n.x} y={n.y} width={n.width} height={n.height} rx={n.rx} {...paint} />;
      })}
    </Svg>
  );
}

/** Trzy gwiazdki: zdobyte pełne złote, reszta kontur przygaszony (legacy `starRow`). */
export function StarRow({ n, size = 12, gap = 2 }: { n: number; size?: number; gap?: number }) {
  return (
    <React.Fragment>
      {[0, 1, 2].map((i) => (
        <Icon key={i} name="star" size={size} fill={i < n} stroke={2} color={i < n ? T.gold : T.muted3} style={i ? { marginLeft: gap } : undefined} />
      ))}
    </React.Fragment>
  );
}
