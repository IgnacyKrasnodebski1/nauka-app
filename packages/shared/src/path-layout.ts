import { chestIndexes } from "./gems.js";

export interface PathNode {
  i: number;
  x: number;
  y: number;
  kind: "level" | "chest" | "trophy";
  /** index into topic.levels for kind=level; chest index (level it follows) for kind=chest */
  levelIndex?: number;
  chestIndex?: number;
}

export interface PathLayout {
  width: number;
  height: number;
  nodes: PathNode[];
  /** SVG path through node centres (cubic segments) */
  d: string;
}

/**
 * Duolingo-style snake: x offsets follow [0, 1, 0, -1] × amplitude, one row per node,
 * chests inserted after levels from chestIndexes(), trophy at the end. One algorithm for web and mobile.
 */
export function layoutPath(levelCount: number, opts: { width?: number; stepY?: number; amplitude?: number; nodeSize?: number; padY?: number } = {}): PathLayout {
  const width = opts.width ?? 360;
  const stepY = opts.stepY ?? 118;
  const amplitude = opts.amplitude ?? Math.min(96, width * 0.27);
  const nodeSize = opts.nodeSize ?? 76;
  const padY = opts.padY ?? nodeSize / 2 + 12;
  const chests = new Set(chestIndexes(levelCount));
  const cx = width / 2;
  const wave = [0, 1, 0, -1];
  const nodes: PathNode[] = [];
  let row = 0;
  const push = (kind: PathNode["kind"], extra: Partial<PathNode>) => {
    nodes.push({ i: nodes.length, x: Math.round(cx + amplitude * wave[row % 4]!), y: padY + row * stepY, kind, ...extra });
    row++;
  };
  for (let li = 0; li < levelCount; li++) {
    push("level", { levelIndex: li });
    if (chests.has(li)) push("chest", { chestIndex: li });
  }
  if (levelCount > 0) push("trophy", {});
  const height = padY + Math.max(0, row - 1) * stepY + nodeSize / 2 + 24;
  let d = "";
  nodes.forEach((n, k) => {
    if (k === 0) d += `M ${n.x} ${n.y}`;
    else {
      const p = nodes[k - 1]!;
      const c = (n.y - p.y) / 2;
      d += ` C ${p.x} ${p.y + c}, ${n.x} ${n.y - c}, ${n.x} ${n.y}`;
    }
  });
  return { width, height, nodes, d };
}
