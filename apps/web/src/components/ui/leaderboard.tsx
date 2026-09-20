"use client";
import type { LeaderboardRow } from "@nauka/shared";
import { m } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icons";

const initials = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";

export function Podium({ rows }: { rows: LeaderboardRow[] }) {
  const top = [rows[1], rows[0], rows[2]];
  const cls = ["p2", "p1", "p3"];
  return (
    <div className="podium" aria-label="Podium">
      {top.map((r, i) => (
        <m.div key={i} className={cn("pd", cls[i])} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 260, damping: 20, delay: i === 1 ? 0 : 0.12 + i * 0.05 }}>
          {r ? (
            <>
              {i === 1 && <Icon name="crown" size={22} style={{ color: "var(--play-yellow)" }} />}
              <div className="av">{initials(r.displayName)}</div>
              <div className="nm">{r.isMe ? "Ty" : r.displayName}</div>
              <div className="xp">{r.xp} XP</div>
            </>
          ) : (
            <>
              <div className="av" style={{ opacity: 0.35 }}>?</div>
              <div className="nm" style={{ color: "var(--faint)" }}>wolne</div>
              <div className="xp" style={{ color: "var(--faint)" }}>—</div>
            </>
          )}
          <div className="base">{cls[i]!.slice(1)}</div>
        </m.div>
      ))}
    </div>
  );
}

export function LeaderboardList({ rows, from = 0, limit }: { rows: LeaderboardRow[]; from?: number; limit?: number }) {
  const list = rows.slice(from, limit ? from + limit : undefined);
  if (!list.length) return null;
  return (
    <div>
      {list.map((r, i) => (
        <m.div key={`${r.rank}-${r.displayName}`} className={cn("lb-row", r.isMe && "me", r.rank <= 3 && "top")} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(0.4, i * 0.03) }}>
          <div className="rk">{r.rank}</div>
          <div className="av">{initials(r.displayName)}</div>
          <div className="nm">{r.isMe ? `${r.displayName} (Ty)` : r.displayName}</div>
          <div className="xp">{r.xp} XP</div>
        </m.div>
      ))}
    </div>
  );
}

/** Home teaser: top 3 + me. */
export function LeaderboardTeaser({ rows, me }: { rows: LeaderboardRow[]; me: { rank: number; xp: number } | null }) {
  const top = rows.slice(0, 3);
  const meRow = rows.find((r) => r.isMe);
  return (
    <div>
      {top.map((r) => (
        <div key={r.rank + r.displayName} className={cn("lb-row top", r.isMe && "me")}>
          <div className="rk">{r.rank}</div>
          <div className="av">{initials(r.displayName)}</div>
          <div className="nm">{r.isMe ? "Ty" : r.displayName}</div>
          <div className="xp">{r.xp} XP</div>
        </div>
      ))}
      {!meRow && me && (
        <div className="lb-row me">
          <div className="rk">{me.rank}</div>
          <div className="av">Ty</div>
          <div className="nm">Ty</div>
          <div className="xp">{me.xp} XP</div>
        </div>
      )}
      {!top.length && <div className="text-muted text-sm py-2">Ranking tygodnia rusza, gdy ktoś zdobędzie pierwsze XP. Zrób lekcję i zajmij miejsce.</div>}
    </div>
  );
}
