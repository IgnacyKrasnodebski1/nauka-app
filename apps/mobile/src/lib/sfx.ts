import type { SfxName } from "@nauka/shared";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { Platform } from "react-native";

/**
 * Dźwięki (expo-audio): jeden `AudioPlayer` na plik, tworzony leniwie przy pierwszym odtworzeniu.
 * `setSfxEnabled()` ustawia AppProvider z `user_meta.sound_on`; `play()` można wołać skądkolwiek (Button3D, lekcja, overlay).
 * Cichy tryb telefonu = cisza (`playsInSilentMode: false`). Na webie expo-audio gra przez <audio> — odtwarzanie rusza po pierwszym geście.
 */

const SOURCES: Record<SfxName, number> = {
  tap: require("../../assets/sfx/tap.wav"),
  correct: require("../../assets/sfx/correct.wav"),
  wrong: require("../../assets/sfx/wrong.wav"),
  combo: require("../../assets/sfx/combo.wav"),
  levelup: require("../../assets/sfx/levelup.wav"),
  streak: require("../../assets/sfx/streak.wav"),
  chest: require("../../assets/sfx/chest.wav"),
  gem: require("../../assets/sfx/gem.wav"),
};

let enabled = true;
let modeSet = false;
const players: Partial<Record<SfxName, AudioPlayer>> = {};

function ensureMode() {
  if (modeSet) return;
  modeSet = true;
  setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers" }).catch(() => {});
}

export function setSfxEnabled(on: boolean) {
  enabled = on;
}
export function sfxEnabled() {
  return enabled;
}

/** Odtwórz efekt (no-op gdy dźwięki wyłączone albo moduł niedostępny). */
export function play(name: SfxName) {
  if (!enabled) return;
  try {
    ensureMode();
    let p = players[name];
    if (!p) {
      p = createAudioPlayer(SOURCES[name]);
      players[name] = p;
    }
    const pl = p;
    pl.seekTo(0)
      .catch(() => {})
      .finally(() => {
        try {
          pl.play();
        } catch {
          /* ignore */
        }
      });
  } catch (e) {
    if (Platform.OS !== "web") console.warn("[sfx]", name, e);
  }
}

/** Hook: `play` respektujący `soundOn` z AppState (flaga globalna ustawiana w AppProvider). */
export function useSfx() {
  return play;
}
