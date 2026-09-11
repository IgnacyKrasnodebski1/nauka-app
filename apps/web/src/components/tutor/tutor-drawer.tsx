"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useApp } from "@/lib/store/app-context";
import type { AppSubject } from "@/lib/types";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

export function TutorFab({ subject, levelId }: { subject: AppSubject; levelId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="fab" onClick={() => setOpen(true)} aria-haspopup="dialog">🤖 wytłumacz</button>
      {open && <TutorDrawer subject={subject} levelId={levelId} onClose={() => setOpen(false)} />}
    </>
  );
}

function TutorDrawer({ subject, levelId, onClose }: { subject: AppSubject; levelId: string; onClose: () => void }) {
  const { session, user, supabase } = useApp();
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", content: `Hej! Jestem tutorem od „${subject.short || subject.name}”. Pytaj o cokolwiek z tej lekcji — tłumaczę na przykładach, nie podaję gotowców do quizu 😉` }]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [msgs]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const question = q.trim();
    if (!question || busy) return;
    setQ("");
    setErr(null);
    const history = msgs.slice(1).slice(-8);
    setMsgs((m) => [...m, { role: "user", content: question }, { role: "assistant", content: "" }]);
    setBusy(true);
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "content-type": "application/json", ...(session?.access_token ? { authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ subjectId: subject.id, levelId, question, history }),
      });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || `Błąd ${res.status}`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: acc }]);
      }
    } catch (e) {
      setErr((e as Error).message);
      setMsgs((m) => m.slice(0, -1));
    } finally {
      setBusy(false);
    }
  }

  const needsLogin = supabase && !user;

  return (
    <div className="fixed inset-0 z-[69] bg-black/50" onClick={onClose}>
      <div className="drawer mx-auto max-w-[560px]" role="dialog" aria-modal="true" aria-label="Tutor AI" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="font-black">🤖 Tutor · {subject.levels.find((l) => l.id === levelId)?.title}</div>
          <button type="button" className="lessonhead x" onClick={onClose} aria-label="Zamknij">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-2 min-h-[200px]">
          {msgs.map((m, i) => (
            <div key={i} className={`bubble ${m.role === "user" ? "me" : "ai"}`}>{m.content || <span className="spinner" aria-label="piszę…" />}</div>
          ))}
          {err && <div className="exfb bad" role="alert">{err}</div>}
          <div ref={bottom} />
        </div>
        {needsLogin ? (
          <div className="p-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
            <p className="text-muted text-sm mb-3">Tutor działa po zalogowaniu (30 wiadomości dziennie za darmo, Pro bez limitu).</p>
            <Link href={`/login?next=${encodeURIComponent(`/app/s/${subject.slug ?? subject.id}/l/${levelId}`)}`} className="pill">Zaloguj się</Link>
          </div>
        ) : (
          <form onSubmit={send} className="flex gap-2 p-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
            <label htmlFor="tutor-q" className="sr-only">Pytanie do tutora</label>
            <input id="tutor-q" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="np. czemu to jest fałsz?" disabled={busy} autoComplete="off" />
            <button type="submit" className="pill sm" disabled={busy || !q.trim()}>wyślij</button>
          </form>
        )}
      </div>
    </div>
  );
}
