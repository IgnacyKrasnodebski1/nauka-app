export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export const KEYS = ["A", "B", "C", "D", "E"] as const;

export function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

export function extOf(name: string, mime: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  if (m && m[1]) return m[1].toLowerCase();
  return { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "application/pdf": "pdf", "text/plain": "txt", "text/markdown": "md" }[mime] ?? "bin";
}
