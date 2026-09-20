/** Recall logo mark: rounded "R" with a spark, on a violet→sky gradient tile. Same geometry for web (SVG) and icons. */
export const LOGO = {
  viewBox: "0 0 64 64",
  gradient: ["#7C5CFF", "#2EC4FF"] as [string, string],
  tileRadius: 16,
  /** the R glyph (white) */
  r: "M18 48 V16 H32 C40 16 45 20.5 45 27 C45 31.6 42.4 35 38.5 36.6 L46 48 H38.6 L31.8 37.6 H24.6 V48 Z M24.6 22 V31.8 H31.8 C35.8 31.8 38.4 29.9 38.4 26.9 C38.4 23.9 35.8 22 31.8 22 Z",
  /** 4-point spark top-right */
  spark: "M50 8 L52.2 14.2 L58.5 16.5 L52.2 18.8 L50 25 L47.8 18.8 L41.5 16.5 L47.8 14.2 Z",
} as const;

export function logoSvg(size = 64, opts: { tile?: boolean; id?: string } = {}): string {
  const id = opts.id ?? "rl";
  const tile = opts.tile !== false;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${LOGO.viewBox}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${LOGO.gradient[0]}"/><stop offset="1" stop-color="${LOGO.gradient[1]}"/></linearGradient></defs>${tile ? `<rect width="64" height="64" rx="${LOGO.tileRadius}" fill="url(#${id})"/>` : ""}<path d="${LOGO.r}" fill="${tile ? "#fff" : `url(#${id})`}"/><path d="${LOGO.spark}" fill="${tile ? "#FFE27A" : "#FFC800"}"/></svg>`;
}
