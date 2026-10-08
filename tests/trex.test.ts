import { describe, expect, test } from "bun:test";
import { TREX, TREX_GROUND_Y } from "../src/config";
import { createTrex, endJump, setDuck, setPose, setSpeedDrop, startJump, trexFrameX, trexHitBoxes, updateJump, updateTrex, type Trex } from "../src/trex";
import { always, frame } from "./helpers";

const rng = always(0.5);

/** Runs a jump to completion, returning y after every frame. */
function recordJump(trex: Trex, speed: number, holdFrames = Infinity): number[] {
  startJump(trex, speed, rng);
  const ys: number[] = [];
  for (let i = 0; i < 200 && trex.jumping; i++) {
    if (i === holdFrames) endJump(trex);
    updateJump(trex, frame, rng);
    ys.push(trex.y);
  }
  return ys;
}

describe("trex", () => {
  test("starts waiting on the ground at the left edge", () => {
    const trex = createTrex(rng);
    expect(trex.pose).toBe("waiting");
    expect(trex.x).toBe(0);
    expect(trex.y).toBe(93); // 150 - 47 - bottom pad
    expect(TREX_GROUND_Y).toBe(93);
  });

  test("a held jump at the starting speed peaks 91px up and lands on the 35th frame", () => {
    // Worked by hand from the original rules: v0 = -10.6, gravity 0.6/frame, capped to -5 once
    // above y=30, positions rounded each frame.
    const ys = recordJump(createTrex(rng), 6);
    expect(ys.slice(0, 8)).toEqual([82, 72, 63, 54, 46, 38, 31, 25]);
    expect(Math.min(...ys)).toBe(2);
    expect(ys.length).toBe(35);
    expect(ys.at(-1)).toBe(93);
  });

  test("releasing the key after the minimum height cuts the jump short", () => {
    const held = recordJump(createTrex(rng), 6);
    const tapped = recordJump(createTrex(rng), 6, 6);
    expect(Math.min(...tapped)).toBeGreaterThan(Math.min(...held));
    expect(tapped.length).toBeLessThan(held.length);
  });

  test("releasing before the minimum height does not shorten the jump", () => {
    expect(recordJump(createTrex(rng), 6, 1)).toEqual(recordJump(createTrex(rng), 6));
  });

  test("landing puts the dino back to running", () => {
    const trex = createTrex(rng);
    recordJump(trex, 6);
    expect(trex.jumping).toBe(false);
    expect(trex.pose).toBe("running");
  });

  test("a speed drop slams the dino down and lands it ducking", () => {
    const trex = createTrex(rng);
    startJump(trex, 6, rng);
    for (let i = 0; i < 10; i++) updateJump(trex, frame, rng);
    const high = trex.y;
    setSpeedDrop(trex);
    updateJump(trex, frame, rng);
    expect(trex.y).toBeGreaterThan(high);
    while (trex.jumping) updateJump(trex, frame, rng);
    expect(trex.ducking).toBe(true);
    expect(trex.pose).toBe("ducking");
  });

  test("ducking toggles between the ducking and running poses", () => {
    const trex = createTrex(rng);
    setPose(trex, "running", rng);
    setDuck(trex, true, rng);
    expect(trex.pose).toBe("ducking");
    setDuck(trex, false, rng);
    expect(trex.pose).toBe("running");
    expect(trex.ducking).toBe(false);
  });

  test("running alternates the two leg frames every 1/12 s", () => {
    const trex = createTrex(rng);
    setPose(trex, "running", rng);
    const seen = new Set<number>();
    for (let i = 0; i < 12; i++) {
      seen.add(trexFrameX(trex));
      updateTrex(trex, frame, rng);
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([88, 132]);
  });

  test("the intro slides the dino right one pixel per frame", () => {
    const trex = createTrex(rng);
    setPose(trex, "running", rng);
    trex.playingIntro = true;
    for (let i = 0; i < 24; i++) updateTrex(trex, frame, rng);
    expect(trex.x).toBe(24);
    expect(trex.x).toBeLessThan(TREX.startX);
  });

  test("while waiting the dino stands still, then blinks once the random delay elapses", () => {
    const slow = always(0.1); // blink delay = ceil(0.1 * 7000) = 700ms
    const trex = createTrex(slow);
    let elapsed = 0;
    const frameAt = (ms: number) => {
      while (elapsed < ms) {
        updateTrex(trex, frame, slow);
        elapsed += frame;
      }
      return trexFrameX(trex);
    };
    expect(frameAt(650)).toBe(0); // eyes open
    expect(frameAt(720)).toBe(44); // eyes closed
    expect(frameAt(1020)).toBe(0); // open again, next blink scheduled
    expect(frameAt(1600)).toBe(0);
  });

  test("uses the ducking hit box while ducking and the running boxes otherwise", () => {
    const trex = createTrex(rng);
    setPose(trex, "running", rng);
    expect(trexHitBoxes(trex)).toHaveLength(6);
    setDuck(trex, true, rng);
    expect(trexHitBoxes(trex)).toEqual([{ x: 1, y: 18, width: 55, height: 25 }]);
  });
});
