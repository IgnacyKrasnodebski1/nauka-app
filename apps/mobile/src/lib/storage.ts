import AsyncStorage from "@react-native-async-storage/async-storage";

/** Klucze AsyncStorage — tylko cache do odczytu offline + flagi UI. Źródłem prawdy jest Supabase. */
export const KEYS = {
  /** snapshot danych zalogowanego usera: `${KEYS.cache}:${userId}` */
  cache: "recall_cache_v3",
  /** ostatni etap (do prefill w onboardingu) */
  stage: "recall_stage_v1",
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
