import type { CSSProperties, ReactNode } from "react";
import { hueFromColor } from "@nauka/shared";
import { hueOf } from "@/lib/hue";

/** Sets the subject hue (`--hue` + `--hue-deep`) for rings, progress, tiles and path nodes. */
export function SubjectTheme({ s, children, className }: { s: { name: string; accent2?: string | null }; children: ReactNode; className?: string }) {
  const h = hueFromColor(hueOf(s));
  const style = { "--hue": h.color, "--hue-deep": h.deep } as CSSProperties;
  return (
    <div style={style} className={className}>
      {children}
    </div>
  );
}

export function hueStyle(s: { name: string; accent2?: string | null }): CSSProperties {
  const h = hueFromColor(hueOf(s));
  return { "--hue": h.color, "--hue-deep": h.deep } as CSSProperties;
}
