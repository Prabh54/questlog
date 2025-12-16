import { calculateLevel, xpForLevel, xpToNextLevel, levelProgress } from '../services/xp.service';

describe('xpForLevel', () => {
  it('matches the formula 50 * n * (n - 1)', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(3)).toBe(300);
    expect(xpForLevel(4)).toBe(600);
    expect(xpForLevel(10)).toBe(4500);
  });

  it('returns 0 for non-positive levels', () => {
    expect(xpForLevel(0)).toBe(0);
    expect(xpForLevel(-3)).toBe(0);
  });
});

describe('calculateLevel', () => {
  it('returns level 1 at 0 XP', () => {
    expect(calculateLevel(0)).toBe(1);
  });

  it('is the inverse of xpForLevel at boundaries', () => {
    for (const n of [1, 2, 3, 4, 5, 10, 20, 50, 100]) {
      expect(calculateLevel(xpForLevel(n))).toBe(n);
    }
  });

  it('stays at level n until exactly reaching xpForLevel(n+1)', () => {
    // Level 2 begins at 100 XP
    expect(calculateLevel(99)).toBe(1);
    expect(calculateLevel(100)).toBe(2);
    // Level 3 begins at 300 XP
    expect(calculateLevel(299)).toBe(2);
    expect(calculateLevel(300)).toBe(3);
    // Level 4 begins at 600 XP
    expect(calculateLevel(599)).toBe(3);
    expect(calculateLevel(600)).toBe(4);
  });

  it('clamps malformed input', () => {
    expect(calculateLevel(-50)).toBe(1);
    expect(calculateLevel(NaN)).toBe(1);
  });
});

describe('xpToNextLevel', () => {
  it('reports remainder to the next boundary', () => {
    expect(xpToNextLevel(0)).toBe(100);       // need 100 to hit L2
    expect(xpToNextLevel(50)).toBe(50);       // need 50 more
    expect(xpToNextLevel(100)).toBe(200);     // L2 → need 200 more for L3
    expect(xpToNextLevel(250)).toBe(50);      // L2 with 50 to go
    expect(xpToNextLevel(300)).toBe(300);     // L3 → need 300 more for L4
  });
});

describe('levelProgress', () => {
  it('reports level, span, and 0..1 progress', () => {
    const p = levelProgress(200); // L2, 100 into the 200-XP L2 band
    expect(p.level).toBe(2);
    expect(p.xpAtCurrentLevel).toBe(100);
    expect(p.xpAtNextLevel).toBe(300);
    expect(p.xpInLevel).toBe(100);
    expect(p.xpToNext).toBe(100);
    expect(p.progress).toBeCloseTo(0.5, 5);
  });
});
