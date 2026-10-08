import type { SpritePos } from "./config";
import type { Scene } from "./scene";
import type { Dimensions, SpriteElement } from "./types";

/** A loaded sprite sheet: the bitmap, its pixel scale and where each element sits in it. */
export interface SpriteSheet {
  readonly image: CanvasImageSource;
  readonly scale: 1 | 2;
  readonly positions: Record<SpriteElement, SpritePos>;
}

/** Executes a scene on a 2D context whose transform already maps 1x units to device pixels. */
export function drawScene(ctx: CanvasRenderingContext2D, sheet: SpriteSheet, scene: Scene, size: Dimensions): void {
  const s = sheet.scale;
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, scene.clipWidth, size.height);
  ctx.clip();
  for (const d of scene.draws) {
    const pos = sheet.positions[d.element];
    if (d.alpha !== undefined) {
      ctx.save();
      ctx.globalAlpha = d.alpha;
    }
    ctx.drawImage(sheet.image, pos.x + d.sx * s, pos.y + d.sy * s, d.width * s, d.height * s, d.x, d.y, d.width, d.height);
    if (d.alpha !== undefined) ctx.restore();
  }
  ctx.restore();
}
