import hitMp3 from "../assets/sounds/hit.mp3";
import pressMp3 from "../assets/sounds/press.mp3";
import reachedMp3 from "../assets/sounds/reached.mp3";
import sprite1xDark from "../assets/sprite-1x-dark.png";
import sprite1x from "../assets/sprite-1x.png";
import sprite2xDark from "../assets/sprite-2x-dark.png";
import sprite2x from "../assets/sprite-2x.png";
import { createSoundPlayer } from "./audio";
import { drawScene, type SpriteSheet } from "./canvas";
import { CANVAS, SPRITE_SHEETS } from "./config";
import { applyInput, createGame, pauseGame, resizeGame, resumeGame, updateGame, type Game } from "./game";
import { buildScene } from "./scene";
import type { InputAction } from "./types";

/** Browser glue: canvas, input, layout and sound around the pure game model. */

const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
const isMobile = isTouch || /Mobi/.test(navigator.userAgent);
const pixelScale: 1 | 2 = (Math.floor(window.devicePixelRatio) || 1) >= 2 ? 2 : 1;
const darkScheme = window.matchMedia("(prefers-color-scheme: dark)");

const JUMP = { down: "jumpPress", up: "jumpRelease" } as const;
const DUCK = { down: "duckPress", up: "duckRelease" } as const;
const KEY_ACTIONS: Record<string, { down: InputAction; up: InputAction }> = {
  Space: JUMP,
  ArrowUp: JUMP,
  KeyW: JUMP,
  ArrowDown: DUCK,
  KeyS: DUCK,
};

const SPRITE_URLS = { 1: { light: sprite1x, dark: sprite1xDark }, 2: { light: sprite2x, dark: sprite2xDark } } as const;

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
}

async function loadSheet(scale: 1 | 2, dark: boolean): Promise<SpriteSheet> {
  const image = new Image();
  image.src = SPRITE_URLS[scale][dark ? "dark" : "light"];
  await image.decode();
  return { image, scale, positions: SPRITE_SHEETS[scale] };
}

/** Fits the 600x150 stage to the viewport: scaled up with margins on wide screens, native width on narrow ones. */
function layout(stage: HTMLElement): number {
  const pad = innerWidth >= 768 ? Math.max(64, Math.round(innerWidth * 0.12)) : 12;
  const available = innerWidth - pad * 2;
  if (available < CANVAS.width) {
    stage.style.width = `${available}px`;
    stage.style.transform = "";
    return available;
  }
  stage.style.width = `${CANVAS.width}px`;
  stage.style.transform = `scale(${Math.min(available / CANVAS.width, (innerHeight - pad * 2) / CANVAS.height)})`;
  return CANVAS.width;
}

function sizeCanvas(canvas: HTMLCanvasElement, width: number): CanvasRenderingContext2D {
  canvas.width = width * pixelScale;
  canvas.height = CANVAS.height * pixelScale;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${CANVAS.height}px`;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(pixelScale, pixelScale);
  return ctx;
}

async function boot(): Promise<void> {
  const stage = byId<HTMLDivElement>("game");
  const hint = byId<HTMLParagraphElement>("hint");
  const canvas = document.createElement("canvas");
  canvas.className = "game-canvas";
  stage.appendChild(canvas);

  let width = layout(stage);
  let ctx = sizeCanvas(canvas, width);
  let sheet = await loadSheet(pixelScale, darkScheme.matches);
  darkScheme.addEventListener("change", async (e) => {
    sheet = await loadSheet(pixelScale, e.matches);
  });

  const game: Game = createGame({ width });
  const sounds = createSoundPlayer({ jump: pressMp3, hit: hitMp3, score: reachedMp3 });

  // Two parts: side by side with a separator on wide screens, stacked without it on narrow ones (see page.html).
  hint.innerHTML = isTouch
    ? "<span>Tap the right half to start and jump</span><span>hold the left half to duck</span>"
    : "<span>Press <kbd>Space</kbd>, <kbd>&uarr;</kbd> or <kbd>W</kbd> to start and jump</span><span><kbd>&darr;</kbd> or <kbd>S</kbd> to duck</span>";

  const act = (action: InputAction): void => {
    sounds.unlock();
    if (action === "jumpPress") hint.hidden = true;
    applyInput(game, action);
  };

  window.addEventListener("keydown", (e) => {
    if (e.code === "Enter" && game.phase === "crashed") act("restart");
    const keys = KEY_ACTIONS[e.code];
    if (!keys) return;
    e.preventDefault();
    if (!e.repeat) act(keys.down);
  });
  window.addEventListener("keyup", (e) => {
    const keys = KEY_ACTIONS[e.code];
    if (keys) act(keys.up);
  });
  canvas.addEventListener("mousedown", (e) => {
    if (e.button === 0 && game.phase === "crashed") act("restart");
  });

  // Touch anywhere on the page, not just on the (possibly tiny) stage: right half jumps, left half ducks.
  const zoneOf = (touch: Touch) => (touch.clientX < innerWidth / 2 ? DUCK : JUMP);
  window.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      for (const touch of Array.from(e.changedTouches)) {
        if (game.phase === "crashed") act("restart");
        else act(zoneOf(touch).down);
      }
    },
    { passive: false },
  );
  window.addEventListener("touchend", (e) => {
    for (const touch of Array.from(e.changedTouches)) act(zoneOf(touch).up);
  });

  const onVisibility = (): void => {
    if (document.hidden) pauseGame(game);
    else resumeGame(game);
  };
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("blur", () => pauseGame(game));
  window.addEventListener("focus", () => resumeGame(game));

  window.addEventListener("resize", () => {
    width = layout(stage);
    ctx = sizeCanvas(canvas, width);
    resizeGame(game, width);
  });

  let last = performance.now();
  const tick = (now: number): void => {
    const delta = now - last;
    last = now;
    updateGame(game, delta);
    for (const sound of game.sounds.splice(0)) {
      sounds.play(sound);
      if (sound === "hit" && isMobile) navigator.vibrate?.(200);
    }
    drawScene(ctx, sheet, buildScene(game), { width, height: CANVAS.height });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

boot();
