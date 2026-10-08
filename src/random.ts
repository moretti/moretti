import type { Rng } from "./types";

/** Integer in [min, max], both inclusive. Same distribution as the original game. */
export const randomInt = (rng: Rng, min: number, max: number): number => Math.floor(rng() * (max - min + 1)) + min;

export const pick = <T>(rng: Rng, items: readonly T[]): T => items[randomInt(rng, 0, items.length - 1)]!;

/** Small deterministic PRNG (mulberry32) for tests and scripts. */
export const seededRng = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
