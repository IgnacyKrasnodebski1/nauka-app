import { contentStems } from "./quiz-quality.js";

/**
 * Rough coverage check of a generated level against its outline scope (the level's list of key points, one "- " line
 * each). Used only for logging / quality stats — the prompt asks for full coverage, this measures how close it got.
 * A point counts as taught when at least half of its key stems appear in the feed, and as checked when at least half
 * appear in the quiz or tasks. The key stems are those of the point's head ("efekt posiadania" in
 * "- efekt posiadania: bardziej cenimy…"), or of the whole line when it has no head.
 */
export interface ScopeCoverage {
  points: number;
  /** scope lines whose head is not in the feed */
  untaught: string[];
  /** scope lines whose head is in no quiz question or task */
  unchecked: string[];
}

export function scopePoints(scope: string): string[] {
  return scope
    .split("\n")
    .map((x) => x.replace(/^\s*[-–•*]\s*/, "").trim())
    .filter(Boolean);
}

export function scopeCoverage(
  scope: string,
  level: { feed: { title: string; body: string }[]; quiz: { q: string; a: string[]; e: string }[]; tasks?: unknown[] },
): ScopeCoverage {
  const feed = new Set(contentStems(level.feed.map((f) => `${f.title} ${f.body}`).join(" ")));
  const checks = new Set(contentStems([...level.quiz.map((q) => `${q.q} ${q.a.join(" ")} ${q.e}`), JSON.stringify(level.tasks ?? [])].join(" ")));
  const out: ScopeCoverage = { points: 0, untaught: [], unchecked: [] };
  for (const p of scopePoints(scope)) {
    const head = p.split(/\s[:—–-]\s|:\s/)[0]!;
    const key = [...new Set(contentStems(head).length ? contentStems(head) : contentStems(p))];
    if (!key.length) continue;
    out.points++;
    const share = (set: Set<string>) => key.filter((w) => set.has(w)).length / key.length;
    if (share(feed) < 0.5) out.untaught.push(p);
    if (share(checks) < 0.5) out.unchecked.push(p);
  }
  return out;
}
