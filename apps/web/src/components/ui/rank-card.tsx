"use client";
import { RANKS, type Rank } from "@nauka/shared";
import type { CSSProperties } from "react";
import { m } from "@/lib/motion";
import { Icon } from "@/components/ui/icons";

/** Profile rank card: name, total XP, progress to the next tier. */
export function RankCard({ rank, totalXp, name, email, avatar }: { rank: Rank; totalXp: number; name: string; email?: string | null; avatar?: string }) {
  const next = RANKS[rank.tier + 1];
  return (
    <div className="card3d rankcard" style={{ "--rk": rank.color, "--cd": rank.color } as CSSProperties}>
      <div className="flex items-center gap-4">
        <div className="tile lg" style={{ background: `color-mix(in srgb, ${rank.color} 20%, transparent)`, borderColor: rank.color, boxShadow: `0 3px 0 ${rank.color}`, fontSize: 30 }} aria-hidden="true">
          {avatar ?? <Icon name="shield" size={34} style={{ color: rank.color }} />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate" style={{ fontSize: 21 }}>{name}</h2>
          {email && <div className="text-muted text-[12.5px] truncate">{email}</div>}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="tag badge !mb-0" style={{ color: rank.color, borderColor: rank.color, background: `color-mix(in srgb, ${rank.color} 14%, transparent)` }}>
              <Icon name="medal" size={13} style={{ display: "inline", verticalAlign: -2, marginRight: 4 }} />
              {rank.name}
            </span>
            <span className="tag badge gold !mb-0"><Icon name="bolt" size={13} style={{ display: "inline", verticalAlign: -2, marginRight: 3 }} />{totalXp} XP</span>
          </div>
        </div>
      </div>
      <div className="mt-4">
        <div className="rankbar"><m.i initial={{ width: 0 }} animate={{ width: `${rank.pct}%` }} transition={{ type: "spring", stiffness: 60, damping: 18 }} style={{ display: "block", height: "100%" }} /></div>
        <div className="flex justify-between text-[12px] font-bold text-muted mt-1.5">
          <span>{rank.name}</span>
          <span>{next ? `${next.min - totalXp} XP do rangi ${next.name}` : "Najwyższa ranga"}</span>
        </div>
      </div>
    </div>
  );
}
