"use client";
import { MASCOT, MASCOT_STATES, plumeForStreak, type MascotState } from "@nauka/shared";
import { useEffect, useId, useState, type CSSProperties } from "react";
import { m, useReducedMotion } from "@/lib/motion";

const MOTION: Record<NonNullable<ReturnType<typeof poseOf>["motion"]>, { animate: Record<string, number[] | number>; transition: Record<string, unknown> }> = {
  bob: { animate: { y: [0, -4, 0] }, transition: { duration: 2.4, repeat: Infinity, ease: "easeInOut" } },
  bounce: { animate: { y: [0, -10, 0], scaleX: [1, 1.04, 1], scaleY: [1, 0.96, 1] }, transition: { duration: 0.7, repeat: Infinity, ease: "easeInOut" } },
  jump: { animate: { y: [0, -18, 0, -8, 0], rotate: [0, -4, 0, 4, 0] }, transition: { duration: 0.9, repeat: Infinity, ease: "easeOut" } },
  droop: { animate: { y: [0, 3, 0], rotate: [0, -2, 0] }, transition: { duration: 3, repeat: Infinity, ease: "easeInOut" } },
  none: { animate: { y: 0 }, transition: {} },
};

function poseOf(state: MascotState) {
  return MASCOT_STATES[state];
}

/**
 * "Rec" — the Recall mascot, rendered from shared MASCOT data. Blinks on a loop, bobs/bounces/jumps per pose,
 * plume scales with the streak. Under reduced motion it is static.
 */
export function Mascot({ state = "idle", size = 120, streak = 0, say, className, style, bubbleSide = "right" }: { state?: MascotState; size?: number; streak?: number; say?: string | null; className?: string; style?: CSSProperties; bubbleSide?: "right" | "top" }) {
  const pose = poseOf(state);
  const reduced = useReducedMotion();
  const id = useId().replace(/:/g, "");
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (reduced || pose.eyeOpen === 0) return;
    let t2: ReturnType<typeof setTimeout>;
    const t = setInterval(() => {
      setBlink(true);
      t2 = setTimeout(() => setBlink(false), 130);
    }, 3200 + Math.random() * 1500);
    return () => {
      clearInterval(t);
      clearTimeout(t2);
    };
  }, [reduced, pose.eyeOpen]);

  const eyeOpen = blink ? 0.08 : pose.eyeOpen;
  const plume = plumeForStreak(streak) * pose.plume;
  const mo = MOTION[pose.motion];
  const { body, colors, eyes, eyeR, pupilR, shine, cheeks } = MASCOT;
  const brows = MASCOT.brows[pose.brow] as readonly string[] | null;
  const mouth = MASCOT.mouths[pose.mouth];
  const filledMouth = pose.mouth === "grin" || pose.mouth === "open";
  const [px, py] = pose.pupil;

  const svg = (
    <m.svg
      width={size}
      height={size}
      viewBox={MASCOT.viewBox}
      aria-label={`Rec, maskotka: ${state}`}
      role="img"
      style={{ display: "block", overflow: "visible", transformOrigin: "50% 90%" }}
      animate={reduced ? undefined : mo.animate}
      transition={reduced ? undefined : mo.transition}
    >
      <defs>
        <radialGradient id={`${id}-b`} cx="42%" cy="35%" r="70%">
          <stop offset="0" stopColor={colors.core} />
          <stop offset="0.55" stopColor={colors.mid} />
          <stop offset="1" stopColor={colors.edge} />
        </radialGradient>
        <linearGradient id={`${id}-p`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={colors.plume[1]} />
          <stop offset="1" stopColor={colors.plume[0]} />
        </linearGradient>
        <radialGradient id={`${id}-g`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={colors.glow} stopOpacity="0.55" />
          <stop offset="1" stopColor={colors.glow} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* glow */}
      <circle cx={body.cx} cy={body.cy} r={body.r + 14} fill={`url(#${id}-g)`} />
      {/* plume */}
      <m.g
        style={{ transformOrigin: `${MASCOT.plume.base[0]}px ${MASCOT.plume.base[1]}px` }}
        animate={reduced ? { scale: plume } : { scale: [plume, plume * 1.08, plume * 0.96, plume], rotate: [0, -3, 3, 0] }}
        transition={reduced ? undefined : { duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
      >
        <path d={MASCOT.plume.d} fill={`url(#${id}-p)`} />
        <path d={MASCOT.plume.inner} fill="#FFF3B0" opacity="0.9" />
      </m.g>
      {/* body */}
      <circle cx={body.cx} cy={body.cy} r={body.r} fill={`url(#${id}-b)`} />
      <ellipse cx={body.cx - 12} cy={body.cy - 20} rx="12" ry="7" fill="#fff" opacity="0.35" transform={`rotate(-25 ${body.cx - 12} ${body.cy - 20})`} />
      {/* cheeks */}
      {cheeks.map((c, i) => (
        <circle key={i} cx={c.cx} cy={c.cy} r={c.r} fill={colors.cheek} opacity={state === "happy" || state === "cheer" ? 0.85 : 0.55} />
      ))}
      {/* eyes */}
      {eyes.map((e, i) => (
        <g key={i}>
          {eyeOpen <= 0.1 ? (
            <path d={`M${e.cx - eyeR.rx} ${e.cy + 2} Q${e.cx} ${e.cy + 6} ${e.cx + eyeR.rx} ${e.cy + 2}`} fill="none" stroke={colors.pupil} strokeWidth="2.4" strokeLinecap="round" />
          ) : (
            <>
              <ellipse cx={e.cx} cy={e.cy} rx={eyeR.rx} ry={eyeR.ry * eyeOpen} fill={colors.eye} />
              <circle cx={e.cx + px} cy={e.cy + py} r={pupilR} fill={colors.pupil} />
              <circle cx={e.cx + px + shine.dx} cy={e.cy + py + shine.dy} r={shine.r} fill="#fff" />
            </>
          )}
        </g>
      ))}
      {/* brows */}
      {brows?.map((d, i) => <path key={i} d={d} fill="none" stroke={colors.mouth} strokeWidth="2.6" strokeLinecap="round" />)}
      {/* mouth */}
      <path d={mouth} fill={filledMouth ? colors.mouth : "none"} stroke={colors.mouth} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      {filledMouth && <path d={pose.mouth === "grin" ? "M52 82 Q60 88 68 82 Z" : "M54 84 Q60 90 66 84 Z"} fill={colors.cheek} opacity="0.8" />}
      {/* extras */}
      {pose.extras === "zzz" && (
        <g fontFamily="var(--font-display)" fontWeight="800" fill={colors.core}>
          {[0, 1, 2].map((k) => (
            <m.text
              key={k}
              x={96 + k * 8}
              y={40 - k * 12}
              fontSize={10 + k * 3}
              initial={{ opacity: 0, y: 0 }}
              animate={reduced ? { opacity: 0.9 } : { opacity: [0, 1, 0], y: [4, -6, -14] }}
              transition={{ duration: 2.4, repeat: Infinity, delay: k * 0.6, ease: "easeOut" }}
            >
              z
            </m.text>
          ))}
        </g>
      )}
      {pose.extras === "sweat" && <path d="M96 52 C92 58 92 63 96 63 C100 63 100 58 96 52 Z" fill="#8FD3FF" opacity="0.9" />}
      {pose.extras === "confetti" &&
        !reduced &&
        [0, 1, 2, 3, 4, 5].map((k) => (
          <m.rect
            key={k}
            x={20 + k * 16}
            y={10}
            width="5"
            height="8"
            rx="1"
            fill={[colors.plume[0], colors.cheek, "#5EC8FF", "#58CC02", colors.plume[1], "#fff"][k]}
            animate={{ y: [0, 70], rotate: [0, 360], opacity: [1, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, delay: k * 0.25, ease: "easeIn" }}
          />
        ))}
    </m.svg>
  );

  if (!say) return <span className={`mascot-wrap ${className ?? ""}`} style={style}>{svg}</span>;
  if (bubbleSide === "top")
    return (
      <span className={`mascot-wrap ${className ?? ""}`} style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 10, ...style }}>
        <m.span className="bubble-say below" initial={{ opacity: 0, y: 6, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 22, delay: 0.2 }}>
          {say}
        </m.span>
        {svg}
      </span>
    );
  return (
    <span className={`mascot-wrap ${className ?? ""}`} style={{ display: "inline-flex", alignItems: "center", gap: 14, ...style }}>
      <m.span className="bubble-say" initial={{ opacity: 0, x: 6, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 22, delay: 0.2 }}>
        {say}
      </m.span>
      {svg}
    </span>
  );
}
