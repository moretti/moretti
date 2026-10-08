import { CLOUD, GAME_OVER, GROUND, METER, OBSTACLES, TREX } from "./config";
import { introProgress, type Game } from "./game";
import { obstacleSpriteX } from "./obstacle";
import { trexFrameX, trexWidth } from "./trex";
import type { SpriteDraw } from "./types";

/** What to put on screen for one frame: sprite blits in paint order, clipped to `clipWidth`. */
export interface Scene {
  readonly clipWidth: number;
  readonly draws: readonly SpriteDraw[];
}

/** Pure projection of the game state onto sprite draws. The canvas layer only executes it. */
export function buildScene(game: Game): Scene {
  const draws: SpriteDraw[] = [];
  const { horizon, trex, meter } = game;

  for (const i of [0, 1] as const) {
    draws.push({ element: "ground", sx: horizon.ground.sourceX[i], sy: 0, width: GROUND.width, height: GROUND.height, x: horizon.ground.x[i], y: GROUND.y });
  }
  for (const cloud of horizon.clouds) {
    draws.push({ element: "cloud", sx: 0, sy: 0, width: CLOUD.width, height: CLOUD.height, x: cloud.x, y: cloud.y });
  }
  for (const obstacle of horizon.obstacles) {
    const { height } = OBSTACLES[obstacle.kind];
    draws.push({ element: obstacle.kind, sx: obstacleSpriteX(obstacle), sy: 0, width: obstacle.width, height, x: obstacle.x, y: obstacle.y });
  }
  draws.push({ element: "trex", sx: trexFrameX(trex), sy: 0, width: trexWidth(trex), height: TREX.height, x: trex.x, y: trex.y });

  if (game.phase !== "idle") {
    if (meter.visible) draws.push(...digitDraws(meter.digits, meter.x));
    if (meter.highScore.length) draws.push(...digitDraws(meter.highScore, meter.x - METER.digits * 2 * METER.glyphWidth, 0.8));
  }
  if (game.phase === "crashed") {
    const centre = game.width / 2;
    draws.push({
      element: "text",
      sx: GAME_OVER.textX,
      sy: GAME_OVER.textY,
      width: GAME_OVER.textWidth,
      height: GAME_OVER.textHeight,
      x: Math.round(centre - GAME_OVER.textWidth / 2),
      y: Math.round((game.height - 25) / 3),
    });
    draws.push({
      element: "restart",
      sx: 0,
      sy: 0,
      width: GAME_OVER.restartWidth,
      height: GAME_OVER.restartHeight,
      x: centre - GAME_OVER.restartWidth / 2,
      y: game.height / 2,
    });
  }

  // Before the first jump only the dino is visible; the reveal widens the view to the full canvas.
  const clipWidth = game.phase === "idle" || game.phase === "starting" ? TREX.width : TREX.width + (game.width - TREX.width) * easeOut(introProgress(game));
  return { clipWidth, draws };
}

/** Glyphs from the digit strip ("" is a blank slot). */
function digitDraws(glyphs: readonly string[], x: number, alpha?: number): SpriteDraw[] {
  const draws: SpriteDraw[] = [];
  glyphs.forEach((glyph, i) => {
    if (glyph === "") return;
    draws.push({ element: "text", sx: Number(glyph) * METER.glyphWidth, sy: 0, width: METER.glyphWidth, height: METER.glyphHeight, x: x + i * METER.advance, y: METER.y, ...(alpha === undefined ? {} : { alpha }) });
  });
  return draws;
}

/** CSS `ease-out`, near enough. */
const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);
