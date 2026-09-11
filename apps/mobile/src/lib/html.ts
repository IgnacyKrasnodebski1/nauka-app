/**
 * Mini konwerter HTML → bloki tekstu (bez WebView). Obsługuje: b/strong, i/em, br, p, h3/h2/h4, ul/ol/li,
 * div.zbox (ramka), table/tr/td (wiersz = komórki łączone " · "), span, a (tylko tekst) + encje.
 * Wszystko inne jest ignorowane (tagi zdejmowane, tekst zostaje).
 */
export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
}
export type BlockKind = "p" | "h3" | "li" | "tr";
export interface Block {
  kind: BlockKind;
  runs: Run[];
  /** komórki (tylko dla tr) */
  cells?: Run[][];
}
export interface Box {
  /** true dla div.zbox / zboxów — renderowane jako karta */
  boxed: boolean;
  blocks: Block[];
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", ndash: "–", mdash: "—", laquo: "«", raquo: "»" };
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1]?.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const TOKEN_RE = /<\/?([a-z0-9]+)([^>]*)>|[^<]+/gi;

export function htmlToBoxes(html: string): Box[] {
  const boxes: Box[] = [];
  let box: Box = { boxed: false, blocks: [] };
  let block: Block | null = null;
  let cell: Run[] | null = null;
  let bold = 0, italic = 0, depthDiv = 0, boxDepth = -1, listIdx = 0, ordered = false;

  const flushBlock = () => {
    if (block) {
      block.runs = trimRuns(block.runs);
      if (block.kind === "tr") block.cells = (block.cells ?? []).map(trimRuns).filter((c) => c.length);
      if (block.runs.length || (block.cells && block.cells.length)) box.blocks.push(block);
    }
    block = null;
    cell = null;
  };
  const flushBox = () => {
    flushBlock();
    if (box.blocks.length) boxes.push(box);
    box = { boxed: false, blocks: [] };
  };
  const ensure = (kind: BlockKind = "p") => {
    if (!block) block = { kind, runs: [] };
    return block;
  };
  const push = (text: string) => {
    if (!text) return;
    const run: Run = { text, bold: bold > 0 || undefined, italic: italic > 0 || undefined };
    if (cell) cell.push(run);
    else ensure().runs.push(run);
  };

  for (const m of html.matchAll(TOKEN_RE)) {
    if (m[1] === undefined) {
      push(decodeEntities(m[0].replace(/\s+/g, " ")));
      continue;
    }
    const closing = m[0].startsWith("</");
    const tag = m[1].toLowerCase();
    const attrs = m[2] ?? "";
    switch (tag) {
      case "b": case "strong": bold += closing ? -1 : 1; break;
      case "i": case "em": italic += closing ? -1 : 1; break;
      case "br": push("\n"); break;
      case "p": case "h2": case "h3": case "h4":
        flushBlock();
        if (!closing) ensure(tag === "p" ? "p" : "h3");
        break;
      case "ul": case "ol":
        flushBlock();
        if (!closing) { listIdx = 0; ordered = tag === "ol"; }
        break;
      case "li":
        flushBlock();
        if (!closing) { listIdx++; block = { kind: "li", runs: [{ text: ordered ? `${listIdx}. ` : "• " }] }; }
        break;
      case "tr":
        flushBlock();
        if (!closing) block = { kind: "tr", runs: [], cells: [] };
        break;
      case "td": case "th":
        if (closing) { cell = null; break; }
        if (!block || block.kind !== "tr") block = { kind: "tr", runs: [], cells: [] };
        cell = [];
        block.cells!.push(cell);
        break;
      case "table": case "tbody": case "thead": flushBlock(); break;
      case "div":
        if (!closing) {
          depthDiv++;
          if (/class\s*=\s*["'][^"']*\bzbox\b/.test(attrs) && boxDepth < 0) {
            flushBox();
            box.boxed = true;
            boxDepth = depthDiv;
          } else flushBlock();
        } else {
          if (boxDepth === depthDiv) { flushBox(); boxDepth = -1; } else flushBlock();
          depthDiv--;
        }
        break;
      default: break; // span, a, img, itp. — ignorujemy tag, zostawiamy tekst
    }
  }
  flushBox();
  return boxes;
}

function trimRuns(runs: Run[]): Run[] {
  const out = runs.filter((r) => r.text.length);
  if (!out.length) return out;
  out[0] = { ...out[0]!, text: out[0]!.text.replace(/^\s+/, "") };
  const last = out.length - 1;
  out[last] = { ...out[last]!, text: out[last]!.text.replace(/\s+$/, "") };
  return out.filter((r) => r.text.length);
}

/** Płaski tekst (do podglądów, TTS, wyszukiwania). */
export function htmlToText(html: string): string {
  return htmlToBoxes(html)
    .flatMap((b) => b.blocks)
    .map((b) => (b.kind === "tr" ? (b.cells ?? []).map((c) => c.map((r) => r.text).join("")).join(" · ") : b.runs.map((r) => r.text).join("")))
    .join("\n")
    .trim();
}
