import { METER } from "./config";

/** The score in the top-right corner, its milestone flash, and the high score. */
export interface Meter {
  x: number;
  /** Glyph indices, most significant first. */
  digits: string[];
  /** "HI" prefix glyphs followed by the best score; empty until the first crash. */
  highScore: string[];
  /** False while the milestone flash hides the digits. */
  visible: boolean;
  flashing: boolean;
  /** Grows past the default when the score overflows. */
  units: number;
  flashTimer: number;
  flashIterations: number;
}

export const scoreFor = (distance: number): number => (distance ? Math.round(distance * METER.coefficient) : 0);

/** Right-aligned, with one spare slot for the overflow digit. */
export const meterX = (canvasWidth: number): number => canvasWidth - METER.advance * (METER.digits + 1);

export const createMeter = (canvasWidth: number): Meter => ({
  x: meterX(canvasWidth),
  digits: pad(0, METER.digits),
  highScore: [],
  visible: true,
  flashing: false,
  units: METER.digits,
  flashTimer: 0,
  flashIterations: 0,
});

const pad = (score: number, units: number): string[] => `${"0".repeat(units)}${score}`.slice(-units).split("");

/** Advances the meter. Returns true on the frame a hundred-point milestone is reached. */
export function updateMeter(meter: Meter, deltaMs: number, distance: number): boolean {
  meter.visible = true;
  if (meter.flashing) {
    updateFlash(meter, deltaMs);
    return false;
  }
  const score = scoreFor(distance);
  if (meter.units === METER.digits && score > maxScore(meter.units)) meter.units++;
  const milestone = score > 0 && score % METER.achievementDistance === 0;
  if (milestone) {
    meter.flashing = true;
    meter.flashTimer = 0;
  }
  meter.digits = pad(score, meter.units);
  return milestone;
}

const maxScore = (units: number): number => 10 ** units - 1;

/** Hidden for 250ms, shown for 250ms, four times; the digits stay frozen meanwhile. */
function updateFlash(meter: Meter, deltaMs: number): void {
  if (meter.flashIterations > METER.flashIterations) {
    meter.flashing = false;
    meter.flashIterations = 0;
    meter.flashTimer = 0;
    return;
  }
  meter.flashTimer += deltaMs;
  if (meter.flashTimer < METER.flashDuration) {
    meter.visible = false;
  } else if (meter.flashTimer > METER.flashDuration * 2) {
    meter.flashTimer = 0;
    meter.flashIterations++;
  }
}

export function setHighScore(meter: Meter, distance: number): void {
  meter.highScore = [...METER.hiPrefix, ...pad(scoreFor(distance), meter.units)];
}

export function resetMeter(meter: Meter): void {
  meter.flashing = false;
  meter.flashIterations = 0;
  meter.flashTimer = 0;
  updateMeter(meter, 0, 0);
}
