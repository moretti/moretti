import { CLOUD, FPS, GROUND, HORIZON, OBSTACLE_KINDS, OBSTACLES, RUN, speedScale } from "./config";
import { createObstacle, updateObstacle, type Obstacle } from "./obstacle";
import { pick, randomInt } from "./random";
import type { ObstacleKind, Rng } from "./types";

/** The ground: two segments, each cut from the flat (0) or bumpy (GROUND.width) strip of the sprite. */
export interface Ground {
  x: [number, number];
  sourceX: [number, number];
}

export interface Cloud {
  x: number;
  readonly y: number;
  /** Space to leave before the next cloud may spawn. */
  readonly gap: number;
  remove: boolean;
}

/** Everything that scrolls: ground, clouds and obstacles. */
export interface Horizon {
  width: number;
  /** How much the speed is scaled down for this width; progression thresholds undo it. */
  speedScale: number;
  readonly ground: Ground;
  clouds: Cloud[];
  obstacles: Obstacle[];
  /** Most recent obstacle kinds, newest first. */
  history: ObstacleKind[];
}

export const createGround = (): Ground => ({ x: [0, GROUND.width], sourceX: [0, GROUND.width] });

export const createCloud = (width: number, rng: Rng): Cloud => ({
  x: width,
  y: randomInt(rng, CLOUD.minY, CLOUD.maxY),
  gap: randomInt(rng, CLOUD.minGap, CLOUD.maxGap),
  remove: false,
});

export const createHorizon = (width: number, rng: Rng): Horizon => ({
  width,
  speedScale: speedScale(width),
  ground: createGround(),
  clouds: [createCloud(width, rng)],
  obstacles: [],
  history: [],
});

export function updateGround(ground: Ground, deltaMs: number, speed: number, rng: Rng): void {
  const increment = Math.floor(speed * (FPS / 1000) * deltaMs);
  const leading = ground.x[0] <= 0 ? 0 : 1;
  const trailing = leading === 0 ? 1 : 0;
  ground.x[leading] -= increment;
  ground.x[trailing] = ground.x[leading] + GROUND.width;
  if (ground.x[leading] <= -GROUND.width) {
    ground.x[leading] += GROUND.width * 2;
    ground.x[trailing] = ground.x[leading] - GROUND.width;
    ground.sourceX[leading] = rng() > GROUND.bumpThreshold ? GROUND.width : 0;
  }
}

/** Clouds move whole pixels only, so they crawl. */
export function updateCloud(cloud: Cloud, speed: number): void {
  if (cloud.remove) return;
  cloud.x -= Math.ceil(speed);
  if (cloud.x + CLOUD.width <= 0) cloud.remove = true;
}

export function updateHorizon(horizon: Horizon, deltaMs: number, speed: number, showObstacles: boolean, rng: Rng): void {
  updateGround(horizon.ground, deltaMs, speed, rng);
  updateClouds(horizon, deltaMs, speed, rng);
  if (showObstacles) updateObstacles(horizon, deltaMs, speed, rng);
}

export function resetHorizon(horizon: Horizon): void {
  horizon.obstacles = [];
  horizon.ground.x = [0, GROUND.width];
}

function updateClouds(horizon: Horizon, deltaMs: number, speed: number, rng: Rng): void {
  const cloudSpeed = (HORIZON.cloudSpeed / 1000) * deltaMs * speed;
  for (const cloud of horizon.clouds) updateCloud(cloud, cloudSpeed);
  const last = horizon.clouds.at(-1);
  if (last && horizon.clouds.length < HORIZON.maxClouds && horizon.width - last.x > last.gap && HORIZON.cloudFrequency > rng()) {
    horizon.clouds.push(createCloud(horizon.width, rng));
  }
  horizon.clouds = horizon.clouds.filter((c) => !c.remove);
}

function updateObstacles(horizon: Horizon, deltaMs: number, speed: number, rng: Rng): void {
  for (const obstacle of horizon.obstacles) updateObstacle(obstacle, deltaMs, speed);
  horizon.obstacles = horizon.obstacles.filter((o) => !o.remove);
  const last = horizon.obstacles.at(-1);
  if (!last) {
    spawnObstacle(horizon, speed, rng);
  } else if (!last.spawnedNext && last.x + last.width + last.gap < horizon.width) {
    spawnObstacle(horizon, speed, rng);
    last.spawnedNext = true;
  }
}

/** Picks a random kind that is allowed at this point of the run and not a third repeat in a row. */
function spawnObstacle(horizon: Horizon, speed: number, rng: Rng): void {
  const difficulty = speed / horizon.speedScale;
  let kind = pick(rng, OBSTACLE_KINDS);
  while (isRepeat(horizon.history, kind) || difficulty < OBSTACLES[kind].minSpeed) kind = pick(rng, OBSTACLE_KINDS);
  horizon.obstacles.push(createObstacle(kind, { width: horizon.width, speed, difficulty, rng }));
  horizon.history = [kind, ...horizon.history].slice(0, RUN.maxObstacleDuplication);
}

const isRepeat = (history: readonly ObstacleKind[], kind: ObstacleKind): boolean =>
  history.length >= RUN.maxObstacleDuplication && history.every((k) => k === kind);
