"use client";
/**
 * Motion foundation: LazyMotion (domAnimation, strict → only `m.*` allowed = small bundle) + MotionConfig honouring
 * prefers-reduced-motion. Import `m` from here for animated elements, `AnimatePresence` for phase transitions.
 */
import { AnimatePresence, LazyMotion, MotionConfig, domAnimation, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import type { ReactNode } from "react";

export { m, AnimatePresence, useReducedMotion };

export const SPRING = {
  /** cards entering, sheets */
  soft: { type: "spring", stiffness: 260, damping: 26 } as const,
  /** buttons, badges, counters */
  snappy: { type: "spring", stiffness: 520, damping: 30 } as const,
  /** mascot jumps, stars, chest pops */
  bouncy: { type: "spring", stiffness: 420, damping: 14 } as const,
} as const;

/** Stagger helper: `custom={i}` + `variants={stagger}` */
export const stagger = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  show: (i: number) => ({ opacity: 1, y: 0, scale: 1, transition: { ...SPRING.soft, delay: i * 0.06 } }),
};

export const fadeSlide = {
  initial: { opacity: 0, x: 28 },
  animate: { opacity: 1, x: 0, transition: SPRING.soft },
  exit: { opacity: 0, x: -28, transition: { duration: 0.16 } },
};

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
