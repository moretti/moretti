import { describe, expect, test } from "bun:test";
import { RUN } from "../src/config";
import { applyInput, createGame, introProgress, pauseGame, resizeGame, restartGame, resumeGame, updateGame, type Game } from "../src/game";
import { scoreFor } from "../src/meter";
import { seededRng } from "../src/random";
import { frame } from "./helpers";

const newGame = (seed = 1, extra: Parameters<typeof createGame>[0] = {}) => createGame({ rng: seededRng(seed), ...extra });

/** Steps the game for `ms`, optionally with a naive autopilot that jumps at the nearest obstacle. */
function run(game: Game, ms: number, autopilot = false) {
  for (let t = 0; t < ms; t += frame) {
    const next = game.horizon.obstacles[0];
    if (autopilot && next && !game.trex.jumping && next.x < game.trex.x + 44 + 90) applyInput(game, "jumpPress");
    updateGame(game, frame);
  }
}

/** Jump, then wait until the dino has landed and the reveal has finished. */
function start(game: Game) {
  applyInput(game, "jumpPress");
  run(game, 1500);
  expect(game.phase).toBe("running");
}

/** Runs without jumping until the dino hits something. */
function runUntilCrash(game: Game) {
  while (game.phase !== "crashed") updateGame(game, frame);
}

/** Drains and returns the queued sounds. */
const sounds = (game: Game) => game.sounds.splice(0);

describe("game", () => {
  test("waits for the player: nothing moves until the first jump", () => {
    const game = newGame();
    run(game, 1000);
    expect(game.phase).toBe("idle");
    expect(game.trex.pose).toBe("waiting");
    expect(game.horizon.ground.x).toEqual([0, 600]);
    expect(game.distanceRan).toBe(0);
  });

  test("the first jump starts the game and plays the jump sound", () => {
    const game = newGame();
    applyInput(game, "jumpPress");
    expect(game.phase).toBe("starting");
    expect(game.trex.jumping).toBe(true);
    expect(sounds(game)).toEqual(["jump"]);
  });

  test("after landing, the reveal runs 400ms while the ground stays put, then the run begins", () => {
    const game = newGame();
    applyInput(game, "jumpPress");
    while (game.trex.jumping) updateGame(game, frame);
    expect(game.phase).toBe("intro");
    const groundBefore = game.horizon.ground.x[0];
    run(game, 200);
    expect(game.horizon.ground.x[0]).toBe(groundBefore);
    expect(introProgress(game)).toBeGreaterThan(0.4);
    run(game, 250);
    expect(game.phase).toBe("running");
    expect(introProgress(game)).toBe(1);
    expect(game.trex.x).toBeGreaterThanOrEqual(23);
    expect(game.trex.x).toBeLessThanOrEqual(27);
    run(game, frame);
    expect(game.horizon.ground.x[0]).toBeLessThan(groundBefore);
  });

  test("obstacles only appear three seconds into the run", () => {
    const game = newGame();
    start(game);
    run(game, RUN.clearTime - game.runningTime - 50);
    expect(game.horizon.obstacles).toHaveLength(0);
    run(game, 100);
    expect(game.horizon.obstacles.length).toBeGreaterThan(0);
  });

  test("speeds up a thousandth per frame and tops out at the max speed", () => {
    const game = newGame();
    start(game);
    const speed = game.speed;
    run(game, 1000, true);
    expect(game.speed).toBeCloseTo(speed + 60 * RUN.acceleration, 2);
    for (let i = 0; i < 20000 && game.phase !== "crashed"; i++) run(game, frame, true);
    expect(game.speed).toBeLessThanOrEqual(RUN.maxSpeed);
  });

  test("distance turns into the score on the meter and plays the milestone sound at 100", () => {
    const game = newGame();
    start(game);
    sounds(game);
    while (scoreFor(game.distanceRan) < 100 && game.phase !== "crashed") run(game, frame, true);
    expect(game.phase).toBe("running");
    expect(game.meter.digits.join("")).toBe("00100");
    expect(sounds(game).filter((s) => s === "score")).toEqual(["score"]);
  });

  test("running into a cactus ends the game, records the high score and freezes everything", () => {
    const game = newGame();
    start(game);
    run(game, 10000);
    expect(game.phase).toBe("crashed");
    expect(sounds(game)).toContain("hit");
    expect(game.trex.pose).toBe("crashed");
    expect(game.highestScore).toBe(Math.ceil(game.distanceRan));
    expect(game.meter.highScore.slice(0, 2)).toEqual(["10", "11"]);
    const distance = game.distanceRan;
    run(game, 1000);
    expect(game.distanceRan).toBe(distance);
  });

  test("the jump key restarts only after the game-over pause; restart works right away", () => {
    const game = newGame();
    start(game);
    runUntilCrash(game);
    updateGame(game, 100);
    applyInput(game, "jumpRelease");
    expect(game.phase).toBe("crashed");
    updateGame(game, RUN.gameOverClearTime);
    applyInput(game, "jumpRelease");
    expect(game.phase).toBe("running");

    runUntilCrash(game);
    applyInput(game, "restart");
    expect(game.phase).toBe("running");
  });

  test("restart clears the course, resets speed and distance, keeps the best score", () => {
    const game = newGame();
    start(game);
    run(game, 10000);
    const best = game.highestScore;
    sounds(game);
    restartGame(game);
    expect(game.distanceRan).toBe(0);
    expect(game.speed).toBe(RUN.startSpeed);
    expect(game.horizon.obstacles).toHaveLength(0);
    expect(game.trex.pose).toBe("running");
    expect(game.highestScore).toBe(best);
    expect(game.meter.digits.join("")).toBe("00000");
    expect(sounds(game)).toEqual(["jump"]);
    run(game, 1000, true);
    expect(game.distanceRan).toBeGreaterThan(0);
  });

  test("down ducks on the ground and slams down in the air", () => {
    const game = newGame();
    start(game);
    applyInput(game, "duckPress");
    expect(game.trex.ducking).toBe(true);
    applyInput(game, "duckRelease");
    expect(game.trex.ducking).toBe(false);
    applyInput(game, "jumpPress");
    run(game, 5 * frame);
    applyInput(game, "duckPress");
    expect(game.trex.speedDrop).toBe(true);
    applyInput(game, "duckRelease");
    expect(game.trex.speedDrop).toBe(false);
  });

  test("pausing freezes the run and resuming carries on", () => {
    const game = newGame();
    start(game);
    pauseGame(game);
    const distance = game.distanceRan;
    run(game, 1000);
    expect(game.distanceRan).toBe(distance);
    resumeGame(game);
    run(game, 1000, true);
    expect(game.distanceRan).toBeGreaterThan(distance);
  });

  test("on a narrow screen the speed is scaled to the width", () => {
    const game = newGame(1, { width: 300 });
    expect(game.speed).toBeCloseTo(((6 * 300) / 600) * RUN.mobileSpeedCoefficient, 5);
    expect(game.meter.x).toBe(300 - 66);
  });

  test("resizing moves the score and the spawn edge", () => {
    const game = newGame();
    resizeGame(game, 400);
    expect(game.width).toBe(400);
    expect(game.meter.x).toBe(400 - 66);
    expect(game.horizon.width).toBe(400);
  });
});
