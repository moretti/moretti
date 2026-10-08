import { checkForCollision } from "./collision";
import { CANVAS, MS_PER_FRAME, RUN, speedScale } from "./config";
import { createHorizon, resetHorizon, updateHorizon, type Horizon } from "./horizon";
import { createMeter, meterX, resetMeter, setHighScore, updateMeter, type Meter } from "./meter";
import { createTrex, endJump, landTrex, setDuck, setPose, setSpeedDrop, startJump, updateJump, updateTrex, type Trex } from "./trex";
import type { GamePhase, GameSound, InputAction, Rng } from "./types";

export interface GameOptions {
  readonly width?: number;
  readonly rng?: Rng;
}

/** The whole simulation. Advance it with `updateGame`, drive it with `applyInput`. */
export interface Game {
  readonly rng: Rng;
  width: number;
  readonly height: number;
  phase: GamePhase;
  /** Set while the tab is hidden; nothing advances. */
  paused: boolean;
  speed: number;
  distanceRan: number;
  highestScore: number;
  /** ms since the run (or the first jump) began; obstacles wait for RUN.clearTime. */
  runningTime: number;
  introTimer: number;
  crashedFor: number;
  readonly trex: Trex;
  readonly horizon: Horizon;
  readonly meter: Meter;
  /** Sounds triggered since the host last drained the queue. */
  readonly sounds: GameSound[];
}

export function createGame({ width = CANVAS.width, rng = Math.random }: GameOptions = {}): Game {
  return {
    rng,
    width,
    height: CANVAS.height,
    phase: "idle",
    paused: false,
    speed: speedFor(RUN.startSpeed, width),
    distanceRan: 0,
    highestScore: 0,
    runningTime: 0,
    introTimer: 0,
    crashedFor: 0,
    trex: createTrex(rng),
    horizon: createHorizon(width, rng),
    meter: createMeter(width),
    sounds: [],
  };
}

const speedFor = (speed: number, width: number): number => speed * speedScale(width);

/** 0 before the reveal, 1 once the full scene is shown. */
export const introProgress = (game: Game): number =>
  game.phase === "idle" || game.phase === "starting" ? 0 : Math.min(1, game.introTimer / RUN.introDuration);

export const isPlaying = (game: Game): boolean => game.phase === "starting" || game.phase === "intro" || game.phase === "running";

export function updateGame(game: Game, deltaMs: number): void {
  if (game.paused) return;
  if (game.phase === "idle") {
    updateTrex(game.trex, deltaMs, game.rng);
    return;
  }
  if (game.phase === "crashed") {
    game.crashedFor += deltaMs;
    return;
  }
  const { trex, horizon, meter, rng } = game;
  if (trex.jumping) updateJump(trex, deltaMs, rng);
  game.runningTime += deltaMs;

  if (game.phase === "starting" && !trex.jumping) {
    game.phase = "intro";
    game.introTimer = 0;
    trex.playingIntro = true;
  }
  if (game.phase === "intro") {
    game.introTimer += deltaMs;
    if (game.introTimer >= RUN.introDuration) {
      game.phase = "running";
      game.runningTime = 0;
      trex.playingIntro = false;
    }
  }

  // The ground only scrolls once the reveal is done; distance and speed build up from the first jump.
  const scrolling = game.phase === "running";
  const hasObstacles = scrolling && game.runningTime > RUN.clearTime;
  updateHorizon(horizon, scrolling ? deltaMs : 0, game.speed, hasObstacles, rng);

  const next = horizon.obstacles[0];
  const collided = hasObstacles && next !== undefined && checkForCollision(next, trex) !== null;
  if (collided) {
    crash(game);
  } else {
    game.distanceRan += (game.speed * deltaMs) / MS_PER_FRAME;
    if (game.speed < RUN.maxSpeed) game.speed += RUN.acceleration;
  }
  if (updateMeter(meter, deltaMs, Math.ceil(game.distanceRan))) game.sounds.push("score");
  if (!collided) updateTrex(trex, deltaMs, rng);
}

function crash(game: Game): void {
  game.sounds.push("hit");
  game.phase = "crashed";
  game.crashedFor = 0;
  game.meter.flashing = false;
  setPose(game.trex, "crashed", game.rng);
  if (game.distanceRan > game.highestScore) {
    game.highestScore = Math.ceil(game.distanceRan);
    setHighScore(game.meter, game.highestScore);
  }
}

export function restartGame(game: Game): void {
  if (game.phase !== "crashed") return;
  game.phase = "running";
  game.paused = false;
  game.runningTime = 0;
  game.distanceRan = 0;
  game.speed = speedFor(RUN.startSpeed, game.width);
  resetMeter(game.meter);
  resetHorizon(game.horizon);
  landTrex(game.trex, game.rng);
  game.sounds.push("jump");
}

export function pauseGame(game: Game): void {
  game.paused = true;
}

export function resumeGame(game: Game): void {
  if (game.phase === "crashed") return;
  game.paused = false;
  if (game.phase !== "idle") landTrex(game.trex, game.rng);
}

export function resizeGame(game: Game, width: number): void {
  game.width = width;
  game.horizon.width = width;
  game.horizon.speedScale = speedScale(width);
  game.meter.x = meterX(width);
}

export function applyInput(game: Game, action: InputAction): void {
  const { trex, rng } = game;
  switch (action) {
    case "jumpPress":
      if (game.phase === "crashed") return;
      if (game.paused) resumeGame(game);
      if (game.phase === "idle") game.phase = "starting";
      if (!trex.jumping && !trex.ducking) {
        game.sounds.push("jump");
        startJump(trex, game.speed, rng);
      }
      return;
    case "jumpRelease":
      if (game.phase === "crashed") {
        if (game.crashedFor >= RUN.gameOverClearTime) restartGame(game);
      } else if (game.paused) {
        resumeGame(game);
      } else {
        endJump(trex);
      }
      return;
    case "duckPress":
      if (!isPlaying(game)) return;
      if (trex.jumping) setSpeedDrop(trex);
      else if (!trex.ducking) setDuck(trex, true, rng);
      return;
    case "duckRelease":
      trex.speedDrop = false;
      setDuck(trex, false, rng);
      return;
    case "restart":
      restartGame(game);
      return;
  }
}
