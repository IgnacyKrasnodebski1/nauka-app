import React, { useEffect } from "react";
import { useApp } from "@/lib/app-state";
import { play } from "@/lib/sfx";
import { AchievementToast, LevelUpModal } from "./Modals";

/** Globalny overlay: kolejka level-upów (modal) i odznak (toast) + dźwięki z emittera. */
export function GamificationOverlay() {
  const app = useApp();
  const rank = app.levelUpQueue[0];
  const ach = app.unlockedQueue[0];
  useEffect(() => {
    if (rank) play("levelup");
  }, [rank]);
  useEffect(() => {
    if (ach) play("gem");
  }, [ach]);
  return (
    <>
      {ach ? <AchievementToast achievement={ach} onDone={app.popUnlocked} /> : null}
      {rank ? <LevelUpModal rank={rank} onClose={app.popLevelUp} /> : null}
    </>
  );
}
