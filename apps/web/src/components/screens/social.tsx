"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { pl, type LeaderboardRow, type Subject, type Topic } from "@nauka/shared";
import { useApp } from "@/lib/store/app-context";
import { fmtNum, initials, noEmoji } from "@/lib/dates";
import { Shell } from "@/components/app/chrome";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

function untilSunday(): string {
  const now = new Date();
  const end = new Date(now); end.setDate(now.getDate() + ((7 - now.getDay()) % 7 || 7)); end.setHours(0, 0, 0, 0);
  const ms = end.getTime() - now.getTime(), d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000);
  return `kończy się za ${d} ${pl(d, "dzień", "dni", "dni")} ${h} ${pl(h, "godzinę", "godziny", "godzin")}`;
}

/** League.html — the real weekly XP ranking (leaderboard RPC); divisions and promotion are marked "wkrótce". */
export function LeagueScreen() {
  const { ready, fetchLeaderboard, myWeeklyRank, showOnLeaderboard } = useApp();
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [me, setMe] = useState<{ rank: number; xp: number; total: number } | null>(null);
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    fetchLeaderboard(30).then((r) => alive && setRows(r));
    myWeeklyRank().then((r) => alive && setMe(r));
    return () => { alive = false; };
  }, [ready, fetchLeaderboard, myWeeklyRank]);
  const up = 3, downFrom = rows ? Math.max(up + 1, rows.length - 1) : 99;
  const ahead = rows && me ? rows.find((r) => r.rank === me.rank - 1) : null;
  return (
    <Shell title="Liga tygodniowa" backHref="/app/profile" pills={false} blob="cyan" cls="league" right={<Link href="/app/friends" className="backbtn" aria-label="Znajomi"><Icon name="users" size={19} stroke={2.4} /></Link>}>
      <div className="lghero"><div className="lgtitle">Ranking tygodnia</div><div className="lgsub a-blink">{untilSunday()}</div></div>
      <div className="soon a-up d1"><Icon name="info" size={18} stroke={2.4} /><span>Dywizje, awanse i spadki — wkrótce. Na razie jedna liga: XP zdobyte w tym tygodniu, reset w niedzielę.</span></div>
      {!showOnLeaderboard && <div className="soon a-up d1"><Icon name="user" size={18} stroke={2.4} /><span>Nie pokazujesz się w lidze. Włącz to w <Link href="/app/settings" className="link">Ustawieniach</Link>.</span></div>}
      <div className="lgrows">
        {rows == null && <div className="spinner" />}
        {rows?.map((r, i) => (
          <div key={r.rank} className="contents">
            {i === downFrom && rows.length > 6 && <div className="lgzone"><i /><span>Strefa spadku · wkrótce</span><i /></div>}
            {i === 0 && <div className="eyebrow up">Awans · wkrótce</div>}
            <div className={cn("lgrow", r.isMe ? "me a-pop" : r.rank <= up ? "up" : i >= downFrom && rows.length > 6 ? "down" : "", "a-up d" + Math.min(6, i + 1))}>
              <span className="rk">{r.rank}</span>
              <div className="av">{initials(r.displayName)}</div>
              {r.isMe ? <div className="grow"><div className="nm">Ty</div><div className="sub">{ahead ? `${fmtNum(ahead.xp - r.xp + 1)} XP do miejsca ${ahead.rank}` : "prowadzisz"}</div></div> : <span className="nm">{r.displayName}</span>}
              <span className="xp">{fmtNum(r.xp)}</span>
            </div>
          </div>
        ))}
        {rows && !rows.length && <div className="sp">Jeszcze pusto — zdobądź XP w tym tygodniu i pojawisz się tutaj.</div>}
      </div>
      {me && !rows?.some((r) => r.isMe) && <div className="lgrow me a-pop"><span className="rk">{me.rank}</span><div className="av">Ty</div><div className="grow"><div className="nm">Ty</div><div className="sub">z {me.total} osób</div></div><span className="xp">{fmtNum(me.xp)}</span></div>}
      <div className="msfoot"><Link href="/app" className="pill a-glow">ZBIERZ XP</Link></div>
    </Shell>
  );
}

/** Friends.html — honest "wkrótce": your code is shown, invites and the shared week are not live yet. */
export function FriendsScreen() {
  const { user, displayName } = useApp();
  const code = (displayName || user.email || "RECALL").replace(/[^a-z]/gi, "").slice(0, 3).toUpperCase().padEnd(3, "X") + "-" + user.id.replace(/-/g, "").slice(0, 4).toUpperCase();
  return (
    <Shell title="Znajomi" backHref="/app/league" pills={false} blob="pink" cls="friends">
      <div className="ssub">wspólny tydzień · wkrótce</div>
      <label className="catsearch a-up"><Icon name="search" size={20} stroke={2.6} /><span className="sr">Szukaj znajomego</span><input type="search" placeholder="Szukaj po nazwie albo kodzie" disabled aria-label="Szukaj znajomego" /></label>
      <div className="codecard a-up d1"><div className="eyebrow">Twój kod</div><div className="code a-pop d1">{code}</div><div className="s">Zaproszenia po kodzie ruszą razem z listą znajomych.</div></div>
      <div className="soon a-up d2"><Icon name="users" size={18} stroke={2.4} /><span>Znajomi, zaproszenia i wspólny tydzień (kto ile XP, czyja seria dłuższa) — wkrótce. Ranking tygodnia już działa w Lidze.</span></div>
      <div className="eyebrow sec">Ten tydzień</div>
      <div className="setcard a-up d3">
        <div className="friendrow"><div className="av">Ty</div><div className="grow"><div className="t">Ty</div><div className="s"><Icon name="flame" size={13} className="ic-flame" />twoja seria i XP z ligi</div></div><Link href="/app/league" className="link">Liga <Icon name="chevron-right" size={14} stroke={3} /></Link></div>
      </div>
      <div className="msfoot"><Link href="/app/league" className="pill ghost">WRÓĆ DO LIGI</Link></div>
    </Shell>
  );
}

/** ShareClass.html — honest "wkrótce": class code is not live; the topic can be shared by link when public sharing lands. */
export function ShareScreen({ topic, subject }: { topic: Topic; subject: Subject }) {
  const { toast } = useApp();
  const copy = () => { navigator.clipboard?.writeText(location.origin + `/app/t/${topic.id}`).then(() => toast("Link skopiowany — na razie działa tylko dla ciebie", "link")).catch(() => {}); };
  return (
    <Shell title="Udostępnij klasie" backHref={`/app/t/${topic.id}`} pills={false} blob="cyan" cls="share">
      <div className="ssub">{noEmoji(subject.name)} · {noEmoji(topic.short || topic.name)}</div>
      <div className="codecard a-up"><div className="eyebrow">Kod dla klasy</div><div className="code a-pop d1">WKRÓTCE</div><div className="s">Ktoś wpisuje kod — ma całą lekcję u siebie.</div></div>
      <div className="soon a-up d2"><Icon name="share" size={18} stroke={2.4} /><span>Udostępnianie klasie jest w budowie. Udostępniane będą poziomy, pytania i fiszki, nigdy skany stron. Inni będą mogli zgłaszać poprawki, ty je zatwierdzasz.</span></div>
      <div className="setcard a-up d3">
        <div className="setrow"><div className="grow"><div className="t">Inni mogą zgłaszać poprawki</div><div className="s">ty zatwierdzasz · wkrótce</div></div></div>
      </div>
      <div className="msfoot"><button type="button" className="pill cyan a-glow" onClick={copy}>SKOPIUJ LINK</button></div>
    </Shell>
  );
}
