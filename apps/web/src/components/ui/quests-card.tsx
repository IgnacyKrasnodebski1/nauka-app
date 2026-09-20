"use client";
import type { Quest, QuestKind } from "@nauka/shared";
import { m } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Btn3d } from "@/components/ui/btn3d";
import { Icon, type IconName } from "@/components/ui/icons";

const ICON: Record<QuestKind, IconName> = { xp: "bolt", combo: "zap", review: "cards", perfect: "star", levels: "flag", games: "play", minutes: "clock", correct: "check" };

/** Three daily quests with progress bars and a 3D "Odbierz" when done. */
export function QuestsCard({ quests, onClaim, title = "Misje dnia", compact }: { quests: Quest[]; onClaim?: (id: string) => void; title?: string; compact?: boolean }) {
  const done = quests.filter((q) => q.done).length;
  return (
    <div className={cn("card3d", compact && "!p-3.5")}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="flex items-center gap-2"><Icon name="target" size={18} style={{ color: "var(--play-purple)" }} />{title}</h3>
        <span className="tag badge !mb-0">{done}/{quests.length}</span>
      </div>
      {quests.map((q, i) => {
        const pct = Math.min(100, Math.round((q.progress / q.target) * 100));
        return (
          <m.div key={q.id} className={cn("quest-row", q.done && "done")} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}>
            <div className="quest-ic">
              <Icon name={q.done ? "check" : ICON[q.kind]} size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="quest-title">{q.title}</div>
              <div className={cn("quest-bar", q.done && "gold")}>
                <i style={{ width: `${pct}%` }} />
                <span>{q.progress} / {q.target}</span>
              </div>
            </div>
            {q.claimed ? (
              <span className="reward" style={{ color: "var(--muted)" }}><Icon name="check" size={14} />odebrano</span>
            ) : q.done && onClaim ? (
              <Btn3d variant="gold" size="sm" onClick={() => onClaim(q.id)}>
                <Icon name="gem" size={14} />+{q.reward}
              </Btn3d>
            ) : (
              <span className="reward"><Icon name="gem" size={14} />+{q.reward}</span>
            )}
          </m.div>
        );
      })}
    </div>
  );
}
