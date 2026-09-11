/** Safe localStorage wrapper (iOS private mode / file:// can throw) — same semantics as legacy STORE. */
const mem: Record<string, string> = {};

export function lsGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return key in mem ? mem[key]! : null;
  }
}
export function lsSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    mem[key] = value;
  }
}
export function lsRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    delete mem[key];
  }
}
export function lsJson<T>(key: string, fallback: T): T {
  const raw = lsGet(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Legacy-compatible keys — do not rename without a migration. */
export const LS = {
  progress: "nauka_progress_v1",
  meta: "nauka_meta_v1",
  srs: "nauka_srs_v1",
  stage: "nauka_stage_v1",
  merged: "nauka_merged_v1",
  onboarded: "nauka_onboarded_v1",
} as const;
