import AsyncStorage from "@react-native-async-storage/async-storage";

/** Klucze — kompatybilne z legacy/web. NIE zmieniać bez migracji. */
export const KEYS = {
  progress: "nauka_progress_v1",
  meta: "nauka_meta_v1",
  srs: "nauka_srs_v1",
  stage: "nauka_stage_v1",
  merged: "nauka_merged_v1",
  onboarded: "nauka_onboarded_v1",
  subjectsCache: "nauka_subjects_cache_v1",
  library: "nauka_library_v1",
} as const;

export async function getJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function setJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("[storage] write failed", key, e);
  }
}

export async function remove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
