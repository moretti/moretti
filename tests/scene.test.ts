import { describe, expect, test } from "bun:test";
import { applyInput, createGame, updateGame } from "../src/game";
import { seededRng } from "../src/random";
import { buildScene } from "../src/scene";
import type { SpriteElement } from "../src/types";
import { frame } from "./helpers";

const by = (scene: ReturnType<typeof buildScene>, element: SpriteElement) => scene.draws.filter((d) => d.element === element);

describe("scene", () => {
  test("a fresh game shows only the standing dino, clipped to its own width", () => {
    const scene = buildScene(createGame({ rng: seededRng(1) }));
    expect(scene.clipWidth).toBe(44);
    expect(by(scene, "trex")).toEqual([{ element: "trex", sx: 0, sy: 0, width: 44, height: 47, x: 0, y: 93 }]);
    expect(by(scene, "ground")).toHaveLength(2);
    expect(by(scene, "text")).toHaveLength(0); // no score before the first jump
  });

  test("paints back to front: ground, clouds, obstacles, dino, score", () => {
    const game = createGame({ rng: seededRng(1) });
    applyInput(game, "jumpPress");
    for (let t = 0; t < 6000; t += frame) updateGame(game, frame);
    const order = buildScene(game).draws.map((d) => d.element);
    const firstIndex = (el: SpriteElement) => order.indexOf(el);
    expect(firstIndex("ground")).toBeLessThan(firstIndex("cloud"));
    expect(firstIndex("cloud")).toBeLessThan(firstIndex("trex"));
    expect(order.lastIndexOf("cactusSmall") < firstIndex("trex") || order.lastIndexOf("cactusLarge") < firstIndex("trex")).toBe(true);
    expect(firstIndex("text")).toBeGreaterThan(firstIndex("trex"));
  });

  test("the score is five glyphs cut from the digit strip, 11px apart", () => {
    const game = createGame({ rng: seededRng(1) });
    applyInput(game, "jumpPress");
    for (let t = 0; t < 3000; t += frame) updateGame(game, frame);
    const digits = by(buildScene(game), "text");
    expect(digits).toHaveLength(5);
    expect(digits.map((d) => d.x)).toEqual([534, 545, 556, 567, 578]);
    expect(digits.every((d) => d.width === 10 && d.height === 13 && d.y === 5)).toBe(true);
    expect(digits.at(-1)!.sx % 10).toBe(0);
  });

  test("after a crash the panel shows GAME OVER, the restart button and a faded high score", () => {
    const game = createGame({ rng: seededRng(1) });
    applyInput(game, "jumpPress");
    while (game.phase !== "crashed") updateGame(game, frame);
    const scene = buildScene(game);
    expect(by(scene, "restart")).toEqual([{ element: "restart", sx: 0, sy: 0, width: 36, height: 32, x: 300 - 18, y: 75 }]);
    const text = by(scene, "text");
    expect(text.find((d) => d.width === 191)).toMatchObject({ sx: 0, sy: 13, height: 11, x: Math.round(300 - 191 / 2), y: Math.round(125 / 3) });
    const hi = text.filter((d) => d.alpha === 0.8);
    expect(hi).toHaveLength(7); // H, I, five digits
    expect(hi[0]!.sx).toBe(100); // glyph 10 = H
  });

  test("the reveal widens the clip from the dino to the whole canvas", () => {
    const game = createGame({ rng: seededRng(1) });
    applyInput(game, "jumpPress");
    while (game.trex.jumping) updateGame(game, frame);
    updateGame(game, 200);
    const mid = buildScene(game).clipWidth;
    expect(mid).toBeGreaterThan(44);
    expect(mid).toBeLessThan(600);
    updateGame(game, 300);
    expect(buildScene(game).clipWidth).toBe(600);
  });
});
