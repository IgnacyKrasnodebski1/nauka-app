"use client";
/**
 * Sound effects: 8 small WAVs from /sfx decoded into an AudioContext that is created + resumed on the first
 * pointerdown / keydown (autoplay policy). Gated by `enabled` (user_meta.sound_on; localStorage "recall_sound"
 * fallback for pre-login pages). `play()` never throws and is a no-op on the server.
 */
import { SFX, type SfxName } from "@nauka/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

const LS_KEY = "recall_sound";
const GAIN: Record<SfxName, number> = { tap: 0.35, correct: 0.6, wrong: 0.55, combo: 0.6, levelup: 0.7, streak: 0.6, chest: 0.65, gem: 0.55 };

interface SfxApi {
  play(name: SfxName): void;
  enabled: boolean;
  setEnabled(v: boolean): void;
}

const Ctx = createContext<SfxApi>({ play: () => {}, enabled: true, setEnabled: () => {} });

function readLs(): boolean {
  try {
    const v = localStorage.getItem(LS_KEY);
    return v === null ? true : v === "1";
  } catch {
    return true;
  }
}

export function SfxProvider({ children }: { children: ReactNode }) {
  // lazy init reads localStorage on the client (server = true; the value never affects markup)
  const [enabled, setEnabledState] = useState(() => (typeof window === "undefined" ? true : readLs()));
  const ctx = useRef<AudioContext | null>(null);
  const buffers = useRef<Partial<Record<SfxName, AudioBuffer>>>({});
  const loading = useRef(false);
  const enabledRef = useRef(enabled);

  const ensure = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!ctx.current) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx.current = new AC();
    }
    if (ctx.current.state === "suspended") ctx.current.resume().catch(() => {});
    if (!loading.current) {
      loading.current = true;
      const ac = ctx.current;
      for (const name of SFX) {
        fetch(`/sfx/${name}.wav`)
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
          .then((ab) => ac.decodeAudioData(ab))
          .then((buf) => {
            buffers.current[name] = buf;
          })
          .catch(() => {});
      }
    }
  }, []);

  useEffect(() => {
    const unlock = () => {
      if (enabledRef.current) ensure();
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [ensure]);

  const play = useCallback((name: SfxName) => {
    if (!enabledRef.current) return;
    try {
      ensure();
      const ac = ctx.current;
      const buf = buffers.current[name];
      if (!ac || !buf) return;
      const src = ac.createBufferSource();
      src.buffer = buf;
      const g = ac.createGain();
      g.gain.value = GAIN[name];
      src.connect(g).connect(ac.destination);
      src.start();
    } catch {
      /* ignore */
    }
  }, [ensure]);

  const setEnabled = useCallback((v: boolean) => {
    enabledRef.current = v;
    setEnabledState(v);
    try {
      localStorage.setItem(LS_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (v) ensure();
  }, [ensure]);

  const api = useMemo<SfxApi>(() => ({ play, enabled, setEnabled }), [play, enabled, setEnabled]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useSfx(): SfxApi {
  return useContext(Ctx);
}
