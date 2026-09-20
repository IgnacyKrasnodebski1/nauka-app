"use client";
import { useEffect, useState } from "react";
import type { LeaderboardRow } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { TopBar } from "@/components/app/chrome";
import { Btn3d } from "@/components/ui/btn3d";
import { Icon } from "@/components/ui/icons";
import { LeaderboardList, Podium } from "@/components/ui/leaderboard";
import { Mascot } from "@/components/mascot/mascot";

/** ms until next Monday 00:00 local. */
function untilReset(now = new Date()): number {
  const d = new Date(now);
  const dow = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + (7 - dow));
  return d.getTime() - now.getTime();
}
function fmtReset(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(h / 24);
  const m = Math.floor((ms % 3600000) / 60000);
  return d > 0 ? `${d} d ${h % 24} h` : `${h} h ${m} min`;
}

export function LeaderboardPage() {
  const { ready, fetchLeaderboard, myWeeklyRank, showOnLeaderboard, streak, todayXp } = useApp();
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [me, setMe] = useState<{ rank: number; xp: number; total: number } | null>(null);
  const [left, setLeft] = useState(untilReset());

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    fetchLeaderboard(50).then((r) => alive && setRows(r));
    myWeeklyRank().then((r) => alive && setMe(r));
    const t = setInterval(() => setLeft(untilReset()), 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const meRow = rows?.find((r) => r.isMe);
  return (
    <>
      <TopBar back="/app" title="Ranking" />
      <div className="px-4 pb-8 pt-3">
        <div className="card3d soft-gold mb-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow" style={{ color: "var(--play-yellow)" }}>Liga tygodnia</div>
              <h2 className="mt-0.5" style={{ fontSize: 22 }}>Kto ogarnia najwięcej?</h2>
              <div className="text-sm text-muted font-bold mt-1 flex items-center gap-1.5"><Icon name="clock" size={14} />reset za {fmtReset(left)}</div>
            </div>
            <Mascot state={me && me.rank <= 3 ? "cheer" : "happy"} size={80} streak={streak} />
          </div>
        </div>

        {rows === null ? (
          <div className="flex items-center justify-center gap-2 text-muted py-10"><span className="spinner" />ładuję ranking…</div>
        ) : rows.length === 0 ? (
          <div className="card3d empty">
            <Mascot state="think" size={100} streak={streak} say="Nikt jeszcze nie zdobył XP w tym tygodniu." bubbleSide="top" />
            <Btn3d variant="green" href="/app/today">Zrób dzienną misję i bądź pierwszy</Btn3d>
          </div>
        ) : (
          <>
            <div className="card3d mb-4"><Podium rows={rows} /></div>
            <div className="card3d">
              <div className="eyebrow mb-2">Pozostali</div>
              <LeaderboardList rows={rows} from={3} />
              {rows.length <= 3 && <div className="text-muted text-sm py-2">Na razie tylko podium. Miejsce na Ciebie.</div>}
            </div>
          </>
        )}

        <div className="lb-pinned mt-4">
          <div className="card3d soft-blue">
            {!showOnLeaderboard ? (
              <div className="flex items-center gap-3">
                <div className="flex-1"><div className="font-extrabold text-txt">Jesteś ukryty w rankingu</div><div className="text-muted text-sm">Włącz widoczność w ustawieniach konta.</div></div>
                <Btn3d variant="blue" size="sm" href="/app/account">Konto</Btn3d>
              </div>
            ) : me || meRow ? (
              <div className="lb-row me !border-0 !bg-transparent !p-0">
                <div className="rk" style={{ color: "var(--play-blue)" }}>#{me?.rank ?? meRow?.rank}</div>
                <div className="av">Ty</div>
                <div className="nm">Ty{me ? ` · ${me.total} w lidze` : ""}</div>
                <div className="xp">{me?.xp ?? meRow?.xp ?? 0} XP</div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex-1"><div className="font-extrabold text-txt">Jeszcze Cię tu nie ma</div><div className="text-muted text-sm">{todayXp} XP dziś. Każdy XP z lekcji liczy się do ligi.</div></div>
                <Btn3d variant="blue" size="sm" href="/app/today">Start</Btn3d>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
