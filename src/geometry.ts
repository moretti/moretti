import type { Box } from "./types";

/** Returns `inner` translated by the origin of `outer`. */
export const offsetBox = (inner: Box, outer: Box): Box => ({ ...inner, x: inner.x + outer.x, y: inner.y + outer.y });

export const boxesIntersect = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
