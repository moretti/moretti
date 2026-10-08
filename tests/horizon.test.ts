import { describe, expect, test } from "bun:test";
import { CANVAS, OBSTACLE_KINDS } from "../src/config";
import { createCloud, createGround, createHorizon, updateCloud, updateGround, updateHorizon, type Horizon } from "../src/horizon";
import { createObstacle, obstacleSpriteX, updateObstacle, type Obstacle, type SpawnContext } from "../src/obstacle";
import { seededRng } from "../src/random";
import { always, frame, seq } from "./helpers";

const ctx: SpawnContext = { width: 600, speed: 6, difficulty: 6, rng: always(0) };

describe("obstacle", () => {
  test("spawns just inside the right edge and scrolls left one speed unit per frame", () => {
    const o = createObstacle("cactusSmall", ctx);
    expect(o.x).toBe(600 - 17);
    updateObstacle(o, frame, 6);
    expect(o.x).toBe(600 - 17 - 6);
  });

  test("clusters only form once the game is fast enough for that cactus type", () => {
    const slow = createObstacle("cactusLarge", { ...ctx, rng: always(0.99) });
    const fast = createObstacle("cactusLarge", { ...ctx, speed: 8, difficulty: 8, rng: always(0.99) });
    expect(slow.size).toBe(1);
    expect(fast.size).toBe(3);
    expect(fast.width).toBe(75);
  });

  test("a cluster stretches the middle hit box and moves the last one to the far edge", () => {
    const o = createObstacle("cactusSmall", { ...ctx, rng: always(0.99) });
    expect(o.size).toBe(3);
    expect(o.hitBoxes[1]).toEqual({ x: 4, y: 0, width: 51 - 5 - 7, height: 34 });
    expect(o.hitBoxes[2]).toEqual({ x: 51 - 7, y: 4, width: 7, height: 14 });
  });

  test("the gap after an obstacle scales with its width and the speed", () => {
    // minGap = round(17 * 6 + 120 * 0.6) = 174, max = round(174 * 1.5) = 261
    expect(createObstacle("cactusSmall", ctx).gap).toBe(174);
    expect(createObstacle("cactusSmall", { ...ctx, rng: seq(0, 0.999) }).gap).toBe(261);
  });

  test("pterodactyls fly at one of three heights, flap at 6 fps and have their own speed offset", () => {
    const p = createObstacle("pterodactyl", { ...ctx, speed: 9, difficulty: 9, rng: always(0.4) });
    expect([100, 75, 50]).toContain(p.y);
    expect(Math.abs(p.speedOffset)).toBe(0.8);
    const frames = new Set<number>();
    for (let i = 0; i < 24; i++) {
      frames.add(obstacleSpriteX(p));
      updateObstacle(p, frame, 9);
    }
    expect([...frames].sort((a, b) => a - b)).toEqual([0, 46]);
  });

  test("pterodactyls use all three heights", () => {
    const rng = seededRng(7);
    const heights = new Set<number>();
    for (let i = 0; i < 50; i++) heights.add(createObstacle("pterodactyl", { ...ctx, speed: 9, difficulty: 9, rng }).y);
    expect([...heights].sort((a, b) => a - b)).toEqual([50, 75, 100]);
  });

  test("a triple cactus is cut from the right part of the sprite strip", () => {
    const o = createObstacle("cactusLarge", { ...ctx, speed: 9, difficulty: 9, rng: always(0.99) });
    expect(obstacleSpriteX(o)).toBe(25 * 3);
  });

  test("is flagged for removal once fully off screen", () => {
    const o = createObstacle("cactusSmall", { ...ctx, width: 100 });
    for (let i = 0; i < 30; i++) updateObstacle(o, frame, 6);
    expect(o.remove).toBe(true);
  });
});

describe("ground", () => {
  test("scrolls both segments by whole pixels per frame", () => {
    const ground = createGround();
    updateGround(ground, frame, 6, always(0.5));
    expect(ground.x).toEqual([-6, 594]);
  });

  test("wraps a segment to the right and may swap it for the bumpy variant", () => {
    const ground = createGround();
    for (let i = 0; i < 101; i++) updateGround(ground, frame, 6, always(0.9));
    expect(ground.x[0]).toBeGreaterThan(0);
    expect(ground.x[1]).toBe(ground.x[0] - 600);
    expect(ground.sourceX[0]).toBe(600); // bumpy variant sits 600px into the sprite strip
  });
});

describe("cloud", () => {
  test("enters from the right at a random sky level and drifts slowly", () => {
    const cloud = createCloud(600, always(0.5));
    expect(cloud.x).toBe(600);
    expect(cloud.y).toBeGreaterThanOrEqual(30);
    expect(cloud.y).toBeLessThanOrEqual(71);
    updateCloud(cloud, 0.02);
    expect(cloud.x).toBe(599); // fractions round up to a whole pixel
  });
});

describe("horizon", () => {
  const horizonWith = (seed: number) => createHorizon(CANVAS.width, seededRng(seed));
  const run = (horizon: Horizon, rng: () => number, ms: number, speed: number, obstacles = true) => {
    for (let t = 0; t < ms; t += frame) updateHorizon(horizon, frame, speed, obstacles, rng);
  };

  test("holds obstacles back until asked, then spawns the first one at the right edge", () => {
    const rng = seededRng(1);
    const horizon = createHorizon(CANVAS.width, rng);
    run(horizon, rng, 1000, 6, false);
    expect(horizon.obstacles).toHaveLength(0);
    updateHorizon(horizon, frame, 6, true, rng);
    expect(horizon.obstacles).toHaveLength(1);
    expect(horizon.obstacles[0]!.x + horizon.obstacles[0]!.width).toBe(CANVAS.width);
  });

  test("spawns the next obstacle only after the previous one's gap has scrolled in", () => {
    const rng = seededRng(2);
    const horizon = createHorizon(CANVAS.width, rng);
    updateHorizon(horizon, frame, 6, true, rng);
    const first = horizon.obstacles[0]!;
    while (horizon.obstacles.length === 1) updateHorizon(horizon, frame, 6, true, rng);
    const second = horizon.obstacles[1]!;
    // the newcomer is placed inside the right edge, so the free space is the gap minus its own width
    const space = second.x - (first.x + first.width);
    expect(space).toBeGreaterThanOrEqual(first.gap - second.width);
    expect(space).toBeLessThan(first.gap - second.width + 6);
  });

  test("never lines up three obstacles of the same kind and keeps pterodactyls for high speed", () => {
    const rng = seededRng(3);
    const horizon = createHorizon(CANVAS.width, rng);
    const seen = new Set<Obstacle>();
    const kinds: string[] = [];
    while (kinds.length < 60) {
      updateHorizon(horizon, frame, 7, true, rng);
      for (const o of horizon.obstacles) {
        if (seen.has(o)) continue;
        seen.add(o);
        kinds.push(o.kind);
      }
    }
    expect(kinds).not.toContain("pterodactyl");
    for (let i = 2; i < kinds.length; i++) expect(kinds[i] === kinds[i - 1] && kinds[i] === kinds[i - 2]).toBe(false);
  });

  test("pterodactyls appear once the speed passes 8.5", () => {
    const rng = seededRng(4);
    const horizon = createHorizon(CANVAS.width, rng);
    const kinds = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      updateHorizon(horizon, frame, 9, true, rng);
      for (const o of horizon.obstacles) kinds.add(o.kind);
    }
    expect(kinds.has("pterodactyl")).toBe(true);
  });

  test("a narrow screen reaches pterodactyls at the same point of the run as a wide one", () => {
    const rng = seededRng(4);
    const narrow = createHorizon(300, rng); // speed scaled to 0.6
    const kinds = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      updateHorizon(narrow, frame, 9 * narrow.speedScale, true, rng);
      for (const o of narrow.obstacles) kinds.add(o.kind);
    }
    expect(narrow.speedScale).toBeCloseTo(0.6, 5);
    expect(kinds.has("pterodactyl")).toBe(true);
  });

  test("keeps at most six clouds and drops the ones that left the screen", () => {
    const rng = seededRng(5);
    const horizon = createHorizon(CANVAS.width, rng);
    let max = 0;
    for (let i = 0; i < 6000; i++) {
      updateHorizon(horizon, frame, 6, false, rng);
      max = Math.max(max, horizon.clouds.length);
      for (const c of horizon.clouds) expect(c.x + 46).toBeGreaterThan(0);
    }
    expect(max).toBeGreaterThan(1);
    expect(max).toBeLessThanOrEqual(6);
  });

  test("the obstacle catalogue matches the original three kinds", () => {
    expect(OBSTACLE_KINDS).toEqual(["cactusSmall", "cactusLarge", "pterodactyl"]);
    expect(horizonWith(1).obstacles).toHaveLength(0);
  });
});
