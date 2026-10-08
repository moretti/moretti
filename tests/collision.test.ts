import { describe, expect, test } from "bun:test";
import { checkForCollision } from "../src/collision";
import { createObstacle, type SpawnContext } from "../src/obstacle";
import { createTrex, setDuck, setPose, startJump, updateJump } from "../src/trex";
import type { ObstacleKind } from "../src/types";
import { always, frame } from "./helpers";

const rng = always(0);
const ctx: SpawnContext = { width: 600, speed: 6, difficulty: 6, rng };

/** An obstacle with its left edge at `x`. */
function obstacleAt(kind: ObstacleKind, x: number, extra: Partial<SpawnContext> = {}) {
  const o = createObstacle(kind, { ...ctx, ...extra });
  o.x = x;
  return o;
}

function runningTrexAt(x: number) {
  const trex = createTrex(rng);
  setPose(trex, "running", rng);
  trex.x = x;
  return trex;
}

describe("checkForCollision", () => {
  test("a cactus far away does not touch the dino", () => {
    expect(checkForCollision(obstacleAt("cactusSmall", 300), runningTrexAt(0))).toBeNull();
  });

  test("running into a cactus reports the pair of hit boxes that overlap", () => {
    const hit = checkForCollision(obstacleAt("cactusSmall", 60), runningTrexAt(50));
    expect(hit).not.toBeNull();
    expect(hit![0].width).toBeLessThanOrEqual(30);
    expect(hit![1].width).toBeLessThanOrEqual(7);
  });

  test("the empty corners of the sprites do not count: a near miss at the toe is safe", () => {
    // the dino's foot box ends 24px in; the cactus' top-left corner is empty
    expect(checkForCollision(obstacleAt("cactusSmall", 50 + 44 - 2), runningTrexAt(50))).toBeNull();
  });

  test("a dino at the top of its jump clears a large cactus underneath", () => {
    const trex = runningTrexAt(50);
    startJump(trex, 6, rng);
    for (let i = 0; i < 16; i++) updateJump(trex, frame, rng);
    expect(trex.y).toBeLessThan(93 - 50);
    expect(checkForCollision(obstacleAt("cactusLarge", 55), trex)).toBeNull();
  });

  test("ducking slips under a mid-height pterodactyl, standing does not", () => {
    const standing = runningTrexAt(50);
    const ducking = runningTrexAt(50);
    setDuck(ducking, true, rng);
    const midHeight = () => obstacleAt("pterodactyl", 55, { speed: 9, difficulty: 9, rng: always(0.4) }); // y = 75
    expect(midHeight().y).toBe(75);
    expect(checkForCollision(midHeight(), standing)).not.toBeNull();
    expect(checkForCollision(midHeight(), ducking)).toBeNull();
  });
});
