import { aiConfigured } from "../client.js";

/**
 * Media configuration from the environment (names only in docs; values never logged):
 *   ELEVENLABS_API_KEY        — text-to-speech; without it reels and podcasts are off (503 `tts_unavailable`)
 *   ELEVENLABS_VOICE_REEL     — reel narrator (default „Dawid”, the owner's voice)
 *   ELEVENLABS_VOICE_FOX      — podcast: the fox (no default; unset → podcast 503 `voices_missing`)
 *   ELEVENLABS_VOICE_SZOP     — podcast: the raccoon (no default; unset → podcast 503 `voices_missing`)
 *   ELEVENLABS_REEL_MODEL     — default `eleven_v4` (expressive, audio tags)
 *   ELEVENLABS_PODCAST_MODEL  — default `eleven_flash_v2_5` (cheaper, long dialogue)
 *   ELEVENLABS_REEL_TAGS      — `0` removes the audio tags from the reel narration (default `1`)
 *   CRAMFOX_MEDIA_MODEL       — Claude model for reel storyboards and podcast scripts (default `claude-sonnet-5`)
 *   CRAMFOX_FOX_MODEL         — Claude model for the fox conversation (default `claude-sonnet-5`)
 */
export const DEFAULT_REEL_VOICE = "gBomWqQijp5IiOPF7hkJ";

export interface MediaConfig {
  /** Anthropic key (or token) present */
  ai: boolean;
  /** ElevenLabs key present */
  tts: boolean;
  /** both podcast voices present */
  voices: boolean;
  elevenKey: string;
  reelVoice: string;
  foxVoice: string;
  szopVoice: string;
  reelModel: string;
  podcastModel: string;
  reelTags: boolean;
  mediaModel: string;
  foxModel: string;
}

export function mediaConfig(env: Record<string, string | undefined> = process.env): MediaConfig {
  const v = (k: string) => (env[k] ?? "").trim();
  const elevenKey = v("ELEVENLABS_API_KEY");
  const foxVoice = v("ELEVENLABS_VOICE_FOX");
  const szopVoice = v("ELEVENLABS_VOICE_SZOP");
  return {
    ai: env === process.env ? aiConfigured() : Boolean(v("ANTHROPIC_API_KEY") || v("ANTHROPIC_AUTH_TOKEN")),
    tts: Boolean(elevenKey),
    voices: Boolean(foxVoice && szopVoice),
    elevenKey,
    reelVoice: v("ELEVENLABS_VOICE_REEL") || DEFAULT_REEL_VOICE,
    foxVoice,
    szopVoice,
    reelModel: v("ELEVENLABS_REEL_MODEL") || "eleven_v4",
    podcastModel: v("ELEVENLABS_PODCAST_MODEL") || "eleven_flash_v2_5",
    reelTags: v("ELEVENLABS_REEL_TAGS") !== "0",
    mediaModel: v("CRAMFOX_MEDIA_MODEL") || "claude-sonnet-5",
    foxModel: v("CRAMFOX_FOX_MODEL") || "claude-sonnet-5",
  };
}
