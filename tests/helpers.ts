import { MS_PER_FRAME } from "../src/config";
import type { Rng } from "../src/types";

export const frame = MS_PER_FRAME;

export const always = (v: number): Rng => () => v;

/** Hands out the given values in order, then repeats. */
export const seq = (...values: number[]): Rng => {
  let i = 0;
  return () => values[i++ % values.length]!;
};
