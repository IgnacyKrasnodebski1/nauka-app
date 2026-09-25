"use client";
import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/** ErrorState.html: icon with "!", title, reason, rows, "what you can do", actions. Used by error.tsx / not-found. */
export function ErrorView({ head = "Recall", icon = "alert", title, reason, rows, can, actions, back }: { head?: string; icon?: string; title: string; reason?: string; rows?: [string, string, string?, boolean?][]; can?: [string, string][]; actions: { label: string; primary?: boolean; text?: boolean; href?: string; onClick?: () => void }[]; back?: string }) {
  return (
    <>
      <div className="topbar">
        {back && <Link href={back} className="backbtn" aria-label="Wróć"><Icon name="back" size={20} stroke={3} /></Link>}
        <div className="logo ttl">{head}</div>
      </div>
      <div className="screen active">
        <div className="scroll errv">
          <div className="errart"><div className="errico a-shake"><Icon name={icon} size={44} stroke={2.4} /><b>!</b></div></div>
          <div className="errtxt"><h1 className="a-up d1">{title}</h1>{reason && <p>{reason}</p>}</div>
          {rows && rows.length > 0 && <div className="errlist a-up d2">{rows.map(([ic, t, s, ok], i) => <div key={i} className={cn("errrow", ok ? "ok" : "bad")}><Icon name={ic} size={18} stroke={2.4} /><div className="grow"><div className="t">{t}</div>{s && <div className="s">{s}</div>}</div></div>)}</div>}
          {can && can.length > 0 && <div className="errcan a-up d3"><div className="eyebrow sec">Co możesz zrobić</div>{can.map(([ic, t]) => <div key={t} className="r"><Icon name={ic} size={18} stroke={2.4} /><span>{t}</span></div>)}</div>}
          <div className="errfoot">
            {actions.map((a) => { const cls = cn("pill", a.primary ? "a-glow" : a.text ? "text" : "ghost"); return a.href ? <Link key={a.label} href={a.href} className={cls}>{a.label}</Link> : <button key={a.label} type="button" className={cls} onClick={a.onClick}>{a.label}</button>; })}
          </div>
        </div>
      </div>
    </>
  );
}
