import { TREX, TREX_GROUND_Y, TREX_HIT_BOXES, TREX_POSES } from "./config";
import type { Box, Rng, TrexPose } from "./types";

/** The dinosaur: pose, jump physics and frame animation. No drawing. */
export interface Trex {
  x: number;
  y: number;
  pose: TrexPose;
  jumping: boolean;
  ducking: boolean;
  jumpVelocity: number;
  reachedMinHeight: boolean;
  speedDrop: boolean;
  /** Set during the reveal; the dino slides right while it is. */
  playingIntro: boolean;
  frame: number;
  frameTimer: number;
  blinkTimer: number;
  blinkDelay: number;
}

const MIN_JUMP_Y = TREX_GROUND_Y - TREX.minJumpHeight;

export const createTrex = (rng: Rng): Trex => ({
  x: 0,
  y: TREX_GROUND_Y,
  pose: "waiting",
  jumping: false,
  ducking: false,
  jumpVelocity: 0,
  reachedMinHeight: false,
  speedDrop: false,
  playingIntro: false,
  frame: 0,
  frameTimer: 0,
  blinkTimer: 0,
  blinkDelay: blinkDelay(rng),
});

const blinkDelay = (rng: Rng): number => Math.ceil(rng() * TREX.blinkTiming);

/** Switches pose and restarts its animation. */
export function setPose(trex: Trex, pose: TrexPose, rng: Rng): void {
  trex.pose = pose;
  trex.frame = 0;
  if (pose === "waiting") {
    trex.blinkTimer = 0;
    trex.blinkDelay = blinkDelay(rng);
  }
}

/** Advances the animation, the blink and the intro slide. */
export function updateTrex(trex: Trex, deltaMs: number, rng: Rng): void {
  trex.frameTimer += deltaMs;
  if (trex.playingIntro && trex.x < TREX.startX) {
    trex.x += Math.round((TREX.startX / TREX.introDuration) * deltaMs);
  }
  if (trex.pose === "waiting") {
    trex.blinkTimer += deltaMs;
    // After the eyes-open frame of a blink, wait for the next random delay.
    if (trex.blinkTimer >= trex.blinkDelay && trex.frame === 1) {
      trex.blinkDelay = blinkDelay(rng);
      trex.blinkTimer = 0;
    }
  }
  const { frames, msPerFrame } = TREX_POSES[trex.pose];
  if (trex.frameTimer >= msPerFrame) {
    trex.frame = trex.frame === frames.length - 1 ? 0 : trex.frame + 1;
    trex.frameTimer = 0;
  }
  if (trex.speedDrop && trex.y === TREX_GROUND_Y) {
    trex.speedDrop = false;
    setDuck(trex, true, rng);
  }
}

/** Sprite x offset (within the T-Rex element) of the frame to draw now. */
export function trexFrameX(trex: Trex): number {
  const frames = TREX_POSES[trex.pose].frames;
  // Waiting: stand still; the blink frames only show once the random delay has elapsed.
  if (trex.pose === "waiting" && trex.blinkTimer < trex.blinkDelay) return 0;
  return frames[trex.frame]!;
}

export const trexWidth = (trex: Trex): number => (trex.ducking && trex.pose !== "crashed" ? TREX.duckWidth : TREX.width);

export const trexHitBoxes = (trex: Trex): readonly Box[] => (trex.ducking ? TREX_HIT_BOXES.ducking : TREX_HIT_BOXES.running);

export function startJump(trex: Trex, speed: number, rng: Rng): void {
  if (trex.jumping) return;
  setPose(trex, "jumping", rng);
  trex.jumpVelocity = TREX.initialJumpVelocity - speed / 10;
  trex.jumping = true;
  trex.reachedMinHeight = false;
  trex.speedDrop = false;
}

/** Jump key released: once past the minimum height, cap the upward velocity. */
export function endJump(trex: Trex): void {
  if (trex.reachedMinHeight && trex.jumpVelocity < TREX.dropVelocity) {
    trex.jumpVelocity = TREX.dropVelocity;
  }
}

/** One physics step of a jump. Positions are rounded per frame, as in the original. */
export function updateJump(trex: Trex, deltaMs: number, rng: Rng): void {
  const framesElapsed = deltaMs / TREX_POSES[trex.pose].msPerFrame;
  const drop = trex.speedDrop ? TREX.speedDropCoefficient : 1;
  trex.y += Math.round(trex.jumpVelocity * drop * framesElapsed);
  trex.jumpVelocity += TREX.gravity * framesElapsed;
  if (trex.y < MIN_JUMP_Y || trex.speedDrop) trex.reachedMinHeight = true;
  if (trex.y < TREX.maxJumpHeight || trex.speedDrop) endJump(trex);
  if (trex.y > TREX_GROUND_Y) landTrex(trex, rng);
  updateTrex(trex, deltaMs, rng);
}

/** Down pressed mid-air: fall fast and land ducking. */
export function setSpeedDrop(trex: Trex): void {
  trex.speedDrop = true;
  trex.jumpVelocity = 1;
}

export function setDuck(trex: Trex, ducking: boolean, rng: Rng): void {
  if (ducking && trex.pose !== "ducking") {
    setPose(trex, "ducking", rng);
    trex.ducking = true;
  } else if (!ducking && trex.pose === "ducking") {
    setPose(trex, "running", rng);
    trex.ducking = false;
  }
}

/** Back on the ground, running (or ducking if a speed drop was pending). */
export function landTrex(trex: Trex, rng: Rng): void {
  trex.y = TREX_GROUND_Y;
  trex.jumpVelocity = 0;
  trex.jumping = false;
  trex.ducking = false;
  setPose(trex, "running", rng);
  if (trex.speedDrop) {
    trex.speedDrop = false;
    setDuck(trex, true, rng);
  }
}
