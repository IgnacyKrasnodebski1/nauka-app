/** Sound effect names — files live in packages/assets/sfx/<name>.wav (copied to each app). */
export const SFX = ["tap", "correct", "wrong", "combo", "levelup", "streak", "chest", "gem"] as const;
export type SfxName = (typeof SFX)[number];
