import type { Box, Dimensions, ObstacleKind, SpriteElement, TrexPose } from "./types";

/** All the numbers of Chrome's offline runner. Pixels are 1x canvas pixels, times are ms. */

export const FPS = 60;
export const MS_PER_FRAME = 1000 / FPS;

export const CANVAS: Dimensions = { width: 600, height: 150 };

export const RUN = {
  acceleration: 0.001,
  bottomPad: 10,
  /** No obstacles during the first seconds of a run. */
  clearTime: 3000,
  /** The jump key cannot restart until this long after a crash. */
  gameOverClearTime: 750,
  gapCoefficient: 0.6,
  /** Length of the reveal animation after the first jump. */
  introDuration: 400,
  maxObstacleDuplication: 2,
  maxSpeed: 13,
  mobileSpeedCoefficient: 1.2,
  startSpeed: 6,
} as const;

/** Narrow screens run proportionally slower so the game stays playable; 1 at full width. */
export const speedScale = (width: number): number =>
  width >= CANVAS.width ? 1 : Math.min(1, (width / CANVAS.width) * RUN.mobileSpeedCoefficient);

export const TREX = {
  width: 44,
  height: 47,
  duckWidth: 59,
  startX: 50,
  /** How long the dino keeps sliding right after the first jump. */
  introDuration: 1500,
  gravity: 0.6,
  initialJumpVelocity: -10,
  dropVelocity: -5,
  minJumpHeight: 30,
  maxJumpHeight: 30,
  speedDropCoefficient: 3,
  blinkTiming: 7000,
} as const;

export const TREX_GROUND_Y = CANVAS.height - TREX.height - RUN.bottomPad;

/** Sprite x offsets (relative to the T-Rex element) and frame rate of each pose. */
export const TREX_POSES: Record<TrexPose, { readonly frames: readonly number[]; readonly msPerFrame: number }> = {
  waiting: { frames: [44, 0], msPerFrame: 1000 / 3 },
  running: { frames: [88, 132], msPerFrame: 1000 / 12 },
  crashed: { frames: [220], msPerFrame: MS_PER_FRAME },
  jumping: { frames: [0], msPerFrame: MS_PER_FRAME },
  ducking: { frames: [262, 321], msPerFrame: 1000 / 8 },
};

export const TREX_HIT_BOXES: { readonly running: readonly Box[]; readonly ducking: readonly Box[] } = {
  running: [
    { x: 22, y: 0, width: 17, height: 16 },
    { x: 1, y: 18, width: 30, height: 9 },
    { x: 10, y: 35, width: 14, height: 8 },
    { x: 1, y: 24, width: 29, height: 5 },
    { x: 5, y: 30, width: 21, height: 4 },
    { x: 9, y: 34, width: 15, height: 4 },
  ],
  ducking: [{ x: 1, y: 18, width: 55, height: 25 }],
};

export interface ObstacleType {
  readonly width: number;
  readonly height: number;
  /** Fixed y, or a list to pick from (pterodactyls). */
  readonly y: number | readonly number[];
  /** Clusters of this type only form at or above this speed. */
  readonly multipleSpeed: number;
  readonly minGap: number;
  /** The type is not spawned below this speed. */
  readonly minSpeed: number;
  readonly hitBoxes: readonly Box[];
  readonly frames?: number;
  readonly frameRate?: number;
  readonly speedOffset?: number;
}

export const OBSTACLE_KINDS: readonly ObstacleKind[] = ["cactusSmall", "cactusLarge", "pterodactyl"];

export const OBSTACLES: Record<ObstacleKind, ObstacleType> = {
  cactusSmall: {
    width: 17,
    height: 35,
    y: 105,
    multipleSpeed: 4,
    minGap: 120,
    minSpeed: 0,
    hitBoxes: [
      { x: 0, y: 7, width: 5, height: 27 },
      { x: 4, y: 0, width: 6, height: 34 },
      { x: 10, y: 4, width: 7, height: 14 },
    ],
  },
  cactusLarge: {
    width: 25,
    height: 50,
    y: 90,
    multipleSpeed: 7,
    minGap: 120,
    minSpeed: 0,
    hitBoxes: [
      { x: 0, y: 12, width: 7, height: 38 },
      { x: 8, y: 0, width: 7, height: 49 },
      { x: 13, y: 10, width: 10, height: 38 },
    ],
  },
  pterodactyl: {
    width: 46,
    height: 40,
    y: [100, 75, 50],
    multipleSpeed: 999,
    minSpeed: 8.5,
    minGap: 150,
    hitBoxes: [
      { x: 15, y: 15, width: 16, height: 5 },
      { x: 18, y: 21, width: 24, height: 6 },
      { x: 2, y: 14, width: 4, height: 3 },
      { x: 6, y: 10, width: 4, height: 7 },
      { x: 10, y: 8, width: 6, height: 9 },
      { x: 16, y: 6, width: 8, height: 6 },
      { x: 24, y: 4, width: 8, height: 6 },
      { x: 32, y: 2, width: 4, height: 2 },
    ],
    frames: 2,
    frameRate: 1000 / 6,
    speedOffset: 0.8,
  },
};

export const OBSTACLE = {
  maxLength: 3,
  maxGapCoefficient: 1.5,
} as const;

export const CLOUD = {
  width: 46,
  height: 14,
  minGap: 100,
  maxGap: 400,
  /** Sky band the clouds are placed in (canvas y). */
  minY: 30,
  maxY: 71,
} as const;

export const GROUND = {
  /** One ground segment; the sprite holds a flat and a bumpy one side by side. */
  width: 600,
  height: 12,
  y: 127,
  bumpThreshold: 0.5,
} as const;

export const HORIZON = {
  cloudSpeed: 0.2,
  cloudFrequency: 0.5,
  maxClouds: 6,
} as const;

export const METER = {
  achievementDistance: 100,
  /** Score per pixel run. */
  coefficient: 0.025,
  flashDuration: 250,
  flashIterations: 3,
  digits: 5,
  y: 5,
  /** Digit glyph size in the sprite and its advance on screen. */
  glyphWidth: 10,
  glyphHeight: 13,
  advance: 11,
  /** Sprite glyph indices for the "HI" prefix. */
  hiPrefix: ["10", "11", ""] as readonly string[],
} as const;

export const GAME_OVER = {
  textX: 0,
  textY: 13,
  textWidth: 191,
  textHeight: 11,
  restartWidth: 36,
  restartHeight: 32,
} as const;

export interface SpritePos {
  readonly x: number;
  readonly y: number;
}

/** Pixel size of the two sprite sheets. */
export const SPRITE_SHEET_SIZES: Record<1 | 2, Dimensions> = { 1: { width: 1204, height: 68 }, 2: { width: 2404, height: 130 } };

/** Top-left of each element in the 1x and 2x sprite sheets (they are laid out differently). */
export const SPRITE_SHEETS: Record<1 | 2, Record<SpriteElement, SpritePos>> = {
  1: {
    cactusLarge: { x: 332, y: 2 },
    cactusSmall: { x: 228, y: 2 },
    cloud: { x: 86, y: 2 },
    ground: { x: 2, y: 54 },
    pterodactyl: { x: 134, y: 2 },
    restart: { x: 2, y: 2 },
    text: { x: 484, y: 2 },
    trex: { x: 677, y: 2 },
  },
  2: {
    cactusLarge: { x: 652, y: 2 },
    cactusSmall: { x: 446, y: 2 },
    cloud: { x: 166, y: 2 },
    ground: { x: 2, y: 104 },
    pterodactyl: { x: 260, y: 2 },
    restart: { x: 2, y: 2 },
    text: { x: 954, y: 2 },
    trex: { x: 1338, y: 2 },
  },
};
