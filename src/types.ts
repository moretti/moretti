/** Shared vocabulary of the game. Everything else imports from here. */

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Dimensions {
  readonly width: number;
  readonly height: number;
}

/** Source of numbers in [0, 1). Injected so runs are reproducible in tests and scripts. */
export type Rng = () => number;

export type TrexPose = "waiting" | "running" | "jumping" | "ducking" | "crashed";

export type ObstacleKind = "cactusSmall" | "cactusLarge" | "pterodactyl";

/** Where the run is: before the first press, first jump, 400ms reveal, playing, or dead. */
export type GamePhase = "idle" | "starting" | "intro" | "running" | "crashed";

export type GameSound = "jump" | "hit" | "score";

export type InputAction = "jumpPress" | "jumpRelease" | "duckPress" | "duckRelease" | "restart";

/** Named regions of the sprite sheet. */
export type SpriteElement = "trex" | "cactusSmall" | "cactusLarge" | "pterodactyl" | "cloud" | "ground" | "text" | "restart";

/** One blit: a rectangle inside a sprite element (1x units) drawn at a canvas position. */
export interface SpriteDraw {
  readonly element: SpriteElement;
  readonly sx: number;
  readonly sy: number;
  readonly width: number;
  readonly height: number;
  readonly x: number;
  readonly y: number;
  readonly alpha?: number;
}
