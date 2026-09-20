"use client";
import Link from "next/link";
import { subjectCompletion, type Subject, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { m } from "@/lib/motion";
import { useSfx } from "@/lib/sfx";
import { examBadge } from "@/lib/types";
import { hueStyle } from "@/components/topic/theme";
import { Icon } from "@/components/ui/icons";
import { Ring } from "@/components/ui/ring";

/** Big 2-column subject tile: emoji, name, topic count, mini ring, exam badge. */
export function SubjectTile({ s, topics, index = 0 }: { s: Subject; topics: Pick<Topic, "id" | "levels">[]; index?: number }) {
  const { progressOf, ready } = useApp();
  const sfx = useSfx();
  let done = 0,
    total = 0;
  for (const t of topics) {
    const c = subjectCompletion(t, ready ? progressOf(t.id) : { xp: 0, levels: {} });
    done += c.done;
    total += c.total;
  }
  const pct = total ? Math.round((done / total) * 100) : 0;
  const badge = examBadge(s.examDate, s.examLabel);
  return (
    <m.div initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 22, delay: 0.05 + index * 0.06 }} style={hueStyle(s)}>
      <Link href={`/app/s/${s.id}`} className="card3d subj-tile press" onClick={() => sfx.play("tap")}>
        <div className="flex items-start justify-between">
          <span className="emo" aria-hidden="true">{s.emoji}</span>
          <Ring pct={pct} size={40} stroke={6} color="var(--hue)" animate={false}>
            <span className="text-[10px] font-extrabold text-txt">{pct}%</span>
          </Ring>
        </div>
        <h3>{s.name}</h3>
        <div className="meta">{topics.length ? `${topics.length} ${plural(topics.length, "temat", "tematy", "tematów")} · ${done}/${total}` : "dodaj pierwszy temat"}</div>
        <div className="foot">
          {badge ? <span className="tag badge danger !mb-0 !text-[11px] truncate"><Icon name="calendar" size={11} style={{ display: "inline", verticalAlign: -1, marginRight: 3 }} />{badge}</span> : <span className="tag badge hue !mb-0 !text-[11px]">otwórz</span>}
          <Icon name="chevron" size={18} style={{ color: "var(--hue)", flex: "none" }} />
        </div>
      </Link>
    </m.div>
  );
}

export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const m10 = n % 10,
    m100 = n % 100;
  if (m10 >= 2 && m10 <= 4 && !(m100 >= 12 && m100 <= 14)) return few;
  return many;
}
