import { FPS, OBSTACLE, OBSTACLES, RUN } from "./config";
import { pick, randomInt } from "./random";
import type { Box, ObstacleKind, Rng } from "./types";

/** One cactus cluster or pterodactyl scrolling in from the right. */
export interface Obstacle {
  readonly kind: ObstacleKind;
  /** Cacti in the cluster (1 for a pterodactyl). */
  readonly size: number;
  readonly width: number;
  readonly y: number;
  /** Free space to leave before the next obstacle. */
  readonly gap: number;
  readonly speedOffset: number;
  readonly hitBoxes: readonly Box[];
  x: number;
  frame: number;
  frameTimer: number;
  remove: boolean;
  spawnedNext: boolean;
}

export interface SpawnContext {
  readonly width: number;
  /** Scroll speed in px per frame; sets the gap. */
  readonly speed: number;
  /** Speed as it would be at full width; decides which kinds and cluster sizes are allowed. */
  readonly difficulty: number;
  readonly rng: Rng;
}

export function createObstacle(kind: ObstacleKind, ctx: SpawnContext): Obstacle {
  const type = OBSTACLES[kind];
  let size = randomInt(ctx.rng, 1, OBSTACLE.maxLength);
  if (size > 1 && type.multipleSpeed > ctx.difficulty) size = 1;
  const width = type.width * size;
  const y = typeof type.y === "number" ? type.y : pick(ctx.rng, type.y);
  const speedOffset = type.speedOffset ? (ctx.rng() > 0.5 ? type.speedOffset : -type.speedOffset) : 0;
  const minGap = Math.round(width * ctx.speed + type.minGap * RUN.gapCoefficient);
  const gap = randomInt(ctx.rng, minGap, Math.round(minGap * OBSTACLE.maxGapCoefficient));
  return {
    kind,
    size,
    width,
    y,
    gap,
    speedOffset,
    hitBoxes: clusterHitBoxes(type.hitBoxes, size, width),
    x: ctx.width - width,
    frame: 0,
    frameTimer: 0,
    remove: false,
    spawnedNext: false,
  };
}

/** A cluster keeps the outer boxes and stretches the middle one across. */
function clusterHitBoxes(boxes: readonly Box[], size: number, width: number): readonly Box[] {
  const [first, middle, last, ...rest] = boxes;
  if (size === 1 || !first || !middle || !last) return boxes;
  return [first, { ...middle, width: width - first.width - last.width }, { ...last, x: width - last.width }, ...rest];
}

export function updateObstacle(obstacle: Obstacle, deltaMs: number, speed: number): void {
  if (obstacle.remove) return;
  obstacle.x -= Math.floor((((speed + obstacle.speedOffset) * FPS) / 1000) * deltaMs);
  const { frames, frameRate } = OBSTACLES[obstacle.kind];
  if (frames && frameRate) {
    obstacle.frameTimer += deltaMs;
    if (obstacle.frameTimer >= frameRate) {
      obstacle.frame = obstacle.frame === frames - 1 ? 0 : obstacle.frame + 1;
      obstacle.frameTimer = 0;
    }
  }
  if (!isObstacleVisible(obstacle)) obstacle.remove = true;
}

export const isObstacleVisible = (obstacle: Obstacle): boolean => obstacle.x + obstacle.width > 0;

/** x offset into the kind's sprite strip: singles first, then doubles, then triples; then the frame. */
export function obstacleSpriteX(obstacle: Obstacle): number {
  const w = OBSTACLES[obstacle.kind].width;
  return w * obstacle.size * (0.5 * (obstacle.size - 1)) + obstacle.frame * w;
}
