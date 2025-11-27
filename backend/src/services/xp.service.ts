/**
 * Pure level / XP math.
 *
 *   level(xp)     = floor((1 + sqrt(1 + xp / 12.5)) / 2)
 *   xpForLevel(n) = 50 * n * (n - 1)
 *   xpToNext(xp)  = xpForLevel(level + 1) - xp
 *
 * This is the inverse pair — calculateLevel and xpForLevel agree at level
 * boundaries (xp == xpForLevel(n) ⇒ level == n).
 */

export function calculateLevel(totalXp: number): number {
  if (!Number.isFinite(totalXp) || totalXp < 0) return 1;
  return Math.floor((1 + Math.sqrt(1 + totalXp / 12.5)) / 2);
}

export function xpForLevel(n: number): number {
  if (n < 1) return 0;
  return 50 * n * (n - 1);
}

export function xpToNextLevel(totalXp: number): number {
  const level = calculateLevel(totalXp);
  return xpForLevel(level + 1) - totalXp;
}

export interface LevelProgress {
  level: number;
  xp: number;
  xpAtCurrentLevel: number;
  xpAtNextLevel: number;
  xpInLevel: number;
  xpToNext: number;
  progress: number; // 0..1
}

export function levelProgress(totalXp: number): LevelProgress {
  const level = calculateLevel(totalXp);
  const xpAtCurrentLevel = xpForLevel(level);
  const xpAtNextLevel = xpForLevel(level + 1);
  const xpInLevel = totalXp - xpAtCurrentLevel;
  const xpToNext = xpAtNextLevel - totalXp;
  const span = xpAtNextLevel - xpAtCurrentLevel;
  return {
    level,
    xp: totalXp,
    xpAtCurrentLevel,
    xpAtNextLevel,
    xpInLevel,
    xpToNext,
    progress: span > 0 ? xpInLevel / span : 0,
  };
}
