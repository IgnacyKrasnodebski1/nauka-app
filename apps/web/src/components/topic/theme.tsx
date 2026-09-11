import type { CSSProperties, ReactNode } from "react";
import { hueOf } from "@/lib/hue";

/** Sets the subject hue (`--hue`) for rings, progress, glow and active path nodes. */
export function SubjectTheme({ s, children, className }: { s: { name: string; accent2?: string | null }; children: ReactNode; className?: string }) {
  const style = { "--hue": hueOf(s) } as CSSProperties;
  return (
    <div style={style} className={className}>
      {children}
    </div>
  );
}
