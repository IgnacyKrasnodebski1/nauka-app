import type { CSSProperties, ReactNode } from "react";

/** Applies a subject's gradient accent via CSS vars (same mechanism as legacy applyTheme). */
export function SubjectTheme({ s, children, className }: { s: { accent: string; accent2: string }; children: ReactNode; className?: string }) {
  const style = { "--accent": s.accent, "--accent2": s.accent2 } as CSSProperties;
  return (
    <div style={style} className={className}>
      {children}
    </div>
  );
}
