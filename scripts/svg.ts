// Generates dino.svg and dino-dark.svg: a looping, CSS-animated replay built from the game's own
// constants and physics, so the README animation stays true to what the game does.
import { checkForCollision } from "../src/collision";
import { CANVAS, CLOUD, FPS, GROUND, HORIZON, METER, OBSTACLES, SPRITE_SHEET_SIZES, SPRITE_SHEETS, TREX, TREX_GROUND_Y, TREX_POSES } from "../src/config";
import { applyInput, createGame, updateGame } from "../src/game";
import { scoreFor } from "../src/meter";
import { createObstacle, type Obstacle } from "../src/obstacle";
import { seededRng } from "../src/random";
import { createTrex, setDuck, setPose, startJump, updateJump, type Trex } from "../src/trex";
import type { ObstacleKind, SpriteElement } from "../src/types";

const SPEED = 9; // the game starts at 6 and accelerates; 9 is a lively mid-run
const PX_PER_S = SPEED * FPS;
const GROUND_STRIP = GROUND.width * 2; // flat + bumpy segment
const LOOP = (4 * GROUND_STRIP) / PX_PER_S; // seconds; a multiple of the ground period so it wraps cleanly
const CLOUD_PX_PER_S = Math.ceil((HORIZON.cloudSpeed / 1000) * (1000 / FPS) * SPEED) * FPS; // clouds move whole pixels per frame
const PTERO_PX_PER_S = (SPEED + OBSTACLES.pterodactyl.speedOffset!) * FPS;
const SCORE_PER_S = scoreFor(PX_PER_S);
const SCORE_START = scoreFor(((6 + SPEED) / 2) * ((SPEED - 6) / 0.001)); // distance the real game covers while accelerating to SPEED
const SHEET = SPRITE_SHEETS[2];
const rng = seededRng(42);

// ---- the dino's x after the intro, and its jump arc, straight from the model ----
const warmup = createGame({ rng });
applyInput(warmup, "jumpPress");
while (warmup.phase !== "running") updateGame(warmup, 1000 / FPS);
const TREX_X = warmup.trex.x;

const jumpArc = (): number[] => {
  const trex = createTrex(rng);
  setPose(trex, "running", rng);
  startJump(trex, SPEED, rng);
  const ys: number[] = [];
  while (trex.jumping) {
    updateJump(trex, 1000 / FPS, rng);
    if (trex.jumping) ys.push(trex.y - TREX_GROUND_Y);
  }
  return ys;
};
const ARC = jumpArc();
const AIR = (ARC.length + 1) / FPS;

// ---- the course: [kind, cluster size, world x of the left edge when the loop starts] ----
type Course = readonly (readonly [ObstacleKind, 1 | 2 | 3, number])[];
const COURSE: Course = [
  ["cactusSmall", 1, 150],
  ["cactusLarge", 1, 447],
  ["cactusSmall", 3, 822],
  ["cactusLarge", 2, 2079],
  ["cactusSmall", 2, 2689],
  ["cactusLarge", 3, 3023],
  ["cactusSmall", 1, 3798],
];
const PTERO = { x: 1625, y: 75 }; // own layer: pterodactyls fly a little faster than the ground
const DUCK: readonly [number, number] = [3.44, 3.82];

/** Builds an obstacle through the real spawner by feeding the rng the values that give the wanted size and height. */
function obstacle(kind: ObstacleKind, size: number, y?: number): Obstacle {
  const sizeRoll = (size - 1) / 3 + 0.01;
  const yRoll = y === undefined ? 0 : (OBSTACLES[kind].y as readonly number[]).indexOf(y) / 3 + 0.01;
  const rolls = [sizeRoll, yRoll, 0.9, 0];
  let i = 0;
  return createObstacle(kind, { width: CANVAS.width, speed: SPEED, difficulty: SPEED, rng: () => rolls[i++ % rolls.length]! });
}
const cacti = COURSE.map(([kind, size, x]) => ({ world: x, obstacle: obstacle(kind, size) }));
const ptero = { world: PTERO.x, obstacle: obstacle("pterodactyl", 1, PTERO.y) };

// jump so each obstacle's centre passes under the dino mid-flight
const jumps = cacti.map(({ world, obstacle: o }) => (CANVAS.width + world + o.width / 2 - (TREX_X + TREX.width / 2)) / PX_PER_S - ARC.length / 2 / FPS);

// ---- prove the choreography with the game's own collision check ----
function trexAt(t: number): Trex {
  const trex = createTrex(rng);
  setPose(trex, "running", rng);
  trex.x = TREX_X;
  for (const j of jumps) {
    if (t >= j && t < j + AIR) {
      const pts = [0, ...ARC, 0];
      const f = (t - j) * FPS;
      const i = Math.floor(f);
      const a = pts[i]!;
      const b = pts[Math.min(i + 1, pts.length - 1)]!;
      trex.y = TREX_GROUND_Y + a + (b - a) * (f - i);
      return trex;
    }
  }
  if (t >= DUCK[0] && t < DUCK[1]) setDuck(trex, true, rng);
  return trex;
}
for (let f = 0; f < LOOP * FPS; f++) {
  const t = f / FPS;
  const trex = trexAt(t);
  for (const { world, obstacle: o } of cacti) {
    o.x = CANVAS.width + world - PX_PER_S * t;
    if (checkForCollision(o, trex)) throw new Error(`collision with ${o.kind}x${o.size} at ${t.toFixed(3)}s`);
  }
  ptero.obstacle.x = CANVAS.width + ptero.world - PTERO_PX_PER_S * t;
  if (checkForCollision(ptero.obstacle, trex)) throw new Error(`collision with the pterodactyl at ${t.toFixed(3)}s`);
}

// ---- SVG ----
const pct = (t: number): number => +((t / LOOP) * 100).toFixed(4);
const sec = (s: number): string => `${s.toFixed(4)}s`;

/** A viewport showing one region of the 2x sheet at 1x size. `inner` can carry an animated <use>. */
function crop(element: SpriteElement, sx: number, sy: number, width: number, height: number, x: number, y: number, inner = `<use href="#s"/>`, cls = ""): string {
  const pos = SHEET[element];
  return `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${pos.x + sx * 2} ${pos.y + sy * 2} ${width * 2} ${height * 2}"${cls ? ` class="${cls}"` : ""}>${inner}</svg>`;
}

/** steps(n) animation that walks through sprite frames `frames` (1x offsets) every `msPerFrame`. */
function frameAnimation(name: string, frames: readonly number[], msPerFrame: number): string {
  const stride = (frames[1]! - frames[0]!) * 2;
  return `.${name}{animation:${name} ${sec((msPerFrame * frames.length) / 1000)} steps(${frames.length},end) infinite}@keyframes ${name}{to{transform:translateX(${-stride * frames.length}px)}}`;
}

type Pose = "run" | "jump" | "duck";
const segments: [number, number, Pose][] = [...jumps.map((j): [number, number, Pose] => [j, j + AIR, "jump"]), [DUCK[0], DUCK[1], "duck"] as [number, number, Pose]].sort((a, b) => a[0] - b[0]);
function visibility(pose: Pose): string {
  const base = pose === "run" ? "visible" : "hidden";
  const points: [number, string][] = [[0, base]];
  for (const [from, to, p] of segments) points.push([from, p === pose ? "visible" : "hidden"], [to, base]);
  points.push([LOOP, base]);
  return points.map(([t, v]) => `${pct(t)}%{visibility:${v}}`).join("");
}
const jumpPoints: [number, number][] = [[0, 0]];
for (const j of jumps) {
  jumpPoints.push([j, 0]);
  ARC.forEach((dy, i) => jumpPoints.push([j + (i + 1) / FPS, dy]));
  jumpPoints.push([j + AIR, 0]);
}
jumpPoints.push([LOOP, 0]);
const jumpKeyframes = jumpPoints.map(([t, dy]) => `${pct(t)}%{transform:translateY(${dy}px)}`).join("");

// score digits: each steps every 10^k points; frozen at the milestone value while the meter flashes
const HUNDRED_S = METER.achievementDistance / SCORE_PER_S;
const FLASH_S = ((METER.flashIterations + 1) * METER.flashDuration * 2) / 1000;
function digitCss(k: number): { css: string; cls: string } {
  const unit = 10 ** k;
  const low = unit < METER.achievementDistance;
  const period = low ? HUNDRED_S : (unit * 10) / SCORE_PER_S;
  const points: [number, number][] = [];
  if (low) {
    points.push([0, 0], [FLASH_S, Math.floor((FLASH_S * SCORE_PER_S) / unit) % 10]);
    for (let s = unit; s < METER.achievementDistance; s += unit) if (s / SCORE_PER_S > FLASH_S) points.push([s / SCORE_PER_S, (s / unit) % 10]);
    points.push([period, 0]);
  } else {
    for (let d = 0; d < 10; d++) points.push([(d * period) / 10, d]);
    points.push([period, 0]);
  }
  const delay = -((SCORE_START % (low ? METER.achievementDistance : unit * 10)) / SCORE_PER_S);
  const cls = `d${k}`;
  const keyframes = points.map(([u, d]) => `${+((u / period) * 100).toFixed(4)}%{transform:translateX(${-METER.glyphWidth * 2 * d}px)}`).join("");
  return { cls, css: `@keyframes ${cls}{${keyframes}}.${cls}{animation:${cls} ${sec(period)} steps(1,end) ${sec(delay)} infinite}` };
}
const digits = Array.from({ length: METER.digits }, (_, i) => digitCss(METER.digits - 1 - i));
const meterX = CANVAS.width - METER.advance * (METER.digits + 1);
const digitEls = digits.map(({ cls }, i) => crop("text", 0, 0, METER.glyphWidth, METER.glyphHeight, meterX + i * METER.advance, METER.y, `<use href="#s" class="${cls}"/>`)).join("");
const flashSteps = Array.from({ length: (METER.flashIterations + 1) * 2 }, (_, i) => `${pct((i * METER.flashDuration) / 1000 / HUNDRED_S * LOOP)}%{visibility:${i % 2 ? "visible" : "hidden"}}`).join("");
const flashCss = `.sc{animation:sc ${sec(HUNDRED_S)} steps(1,end) ${sec(-((SCORE_START % METER.achievementDistance) / SCORE_PER_S))} infinite}@keyframes sc{${flashSteps}${+((FLASH_S / HUNDRED_S) * 100).toFixed(4)}%,100%{visibility:visible}}`;

// ---- scene ----
const CLOUD_STRIP = CLOUD_PX_PER_S * LOOP;
const clouds = [
  [80, 42],
  [330, 60],
] as const;
const cloudEls = [0, 1, 2].flatMap((k) => clouds.map(([x, y]) => crop("cloud", 0, 0, CLOUD.width, CLOUD.height, x + k * CLOUD_STRIP, y))).join("");
const groundEls = [0, 1].map((k) => crop("ground", 0, 0, GROUND_STRIP, GROUND.height, k * GROUND_STRIP, GROUND.y)).join("");
const cactusEls = cacti
  .map(({ world, obstacle: o }) => crop(o.kind, OBSTACLES[o.kind].width * o.size * 0.5 * (o.size - 1), 0, o.width, OBSTACLES[o.kind].height, CANVAS.width + world, o.y))
  .join("");
const pteroEl = crop("pterodactyl", 0, 0, OBSTACLES.pterodactyl.width, OBSTACLES.pterodactyl.height, CANVAS.width + ptero.world, ptero.obstacle.y, `<use href="#s" class="fl"/>`);
const trexEls =
  crop("trex", TREX_POSES.running.frames[0]!, 0, TREX.width, TREX.height, 0, 0, `<use href="#s" class="rn"/>`, "r") +
  crop("trex", TREX_POSES.jumping.frames[0]!, 0, TREX.width, TREX.height, 0, 0, `<use href="#s"/>`, "j") +
  crop("trex", TREX_POSES.ducking.frames[0]!, 0, TREX.duckWidth, TREX.height, 0, 0, `<use href="#s" class="dk"/>`, "d");

const css = [
  `.g{animation:g ${sec(GROUND_STRIP / PX_PER_S)} linear infinite}@keyframes g{to{transform:translateX(-${GROUND_STRIP}px)}}`,
  `.c{animation:c ${sec(LOOP)} linear infinite}@keyframes c{to{transform:translateX(-${CLOUD_STRIP.toFixed(2)}px)}}`,
  `.o{animation:o ${sec(LOOP)} linear infinite}@keyframes o{to{transform:translateX(-${(PX_PER_S * LOOP).toFixed(2)}px)}}`,
  `.p{animation:p ${sec(LOOP)} linear infinite}@keyframes p{to{transform:translateX(-${(PTERO_PX_PER_S * LOOP).toFixed(2)}px)}}`,
  frameAnimation("fl", [0, OBSTACLES.pterodactyl.width], OBSTACLES.pterodactyl.frameRate!),
  frameAnimation("rn", TREX_POSES.running.frames, TREX_POSES.running.msPerFrame),
  frameAnimation("dk", TREX_POSES.ducking.frames, TREX_POSES.ducking.msPerFrame),
  `.y{animation:y ${sec(LOOP)} linear infinite}@keyframes y{${jumpKeyframes}}`,
  ...(["run", "jump", "duck"] as const).map((pose) => `.${pose[0]}{animation:${pose[0]} ${sec(LOOP)} steps(1,end) infinite}@keyframes ${pose[0]}{${visibility(pose)}}`),
  flashCss,
  ...digits.map((d) => d.css),
].join("");

async function render(spritePath: string): Promise<string> {
  const sprite = Buffer.from(await Bun.file(spritePath).arrayBuffer()).toString("base64");
  const { width, height } = SPRITE_SHEET_SIZES[2];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS.width}" height="${CANVAS.height}" viewBox="0 0 ${CANVAS.width} ${CANVAS.height}">
<title>T-Rex Runner</title>
<style>${css}</style>
<defs><image id="s" width="${width}" height="${height}" href="data:image/png;base64,${sprite}"/></defs>
<g class="g">${groundEls}</g>
<g class="c">${cloudEls}</g>
<g class="o">${cactusEls}</g>
<g class="p">${pteroEl}</g>
<g transform="translate(${TREX_X} ${TREX_GROUND_Y})"><g class="y">${trexEls}</g></g>
<g class="sc">${digitEls}</g>
</svg>
`;
}

await Bun.write("dino.svg", await render("assets/sprite-2x.png"));
await Bun.write("dino-dark.svg", await render("assets/sprite-2x-dark.png"));
console.log(`dino.svg: ${LOOP.toFixed(2)}s loop, dino at x=${TREX_X}, jump ${ARC.length} frames (apex ${Math.min(...ARC)}px), no collisions`);
