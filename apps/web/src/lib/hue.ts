import { SUBJECT_HUES, subjectHue } from "@nauka/shared";

/** Subject hue for rings / progress / glow. Uses the stored accent2 when it is one of the curated hues, else derives from the name. */
export function hueOf(s: { name: string; accent2?: string | null }): string {
  const h = s.accent2 ?? "";
  return SUBJECT_HUES.some((x) => x.color.toLowerCase() === h.toLowerCase()) ? h : subjectHue(s.name).color;
}
