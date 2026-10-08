import type { GameSound } from "./types";

export interface SoundPlayer {
  /** Call from every user input; the first gesture the browser accepts unlocks playback. */
  unlock(): void;
  play(sound: GameSound): void;
}

/**
 * Plays the three original clips through Web Audio, which is the only route with low enough
 * latency for a game. Two iOS quirks are handled here:
 * - the context can only be started from an accepted gesture (touchend, not touchstart), so
 *   `unlock` keeps retrying until the context runs;
 * - Web Audio is silenced by the ring switch unless a media element is playing, so a silent
 *   looping element is kept alive to put the page in playback mode.
 */
export function createSoundPlayer(sources: Record<GameSound, string>): SoundPlayer {
  let context: AudioContext | undefined;
  let keepAlive: HTMLAudioElement | undefined;
  const buffers = new Map<GameSound, AudioBuffer>();

  const unlock = (): void => {
    if (!context) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      context = new Ctor();
      for (const [sound, url] of Object.entries(sources) as [GameSound, string][]) {
        void decode(context, url).then((buffer) => buffers.set(sound, buffer), () => undefined);
      }
    }
    if (context.state !== "running") void context.resume();
    if (!keepAlive) {
      const element = new Audio(SILENCE);
      element.loop = true;
      keepAlive = element;
      element.play()?.catch(() => {
        keepAlive = undefined; // refused: not a real gesture yet, try again on the next input
      });
    }
  };

  const play = (sound: GameSound): void => {
    const buffer = buffers.get(sound);
    if (!context || !buffer) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start(0);
  };

  return { unlock, play };
}

/** decodeAudioData with the callback signature, which every Safari supports. */
const decode = async (context: AudioContext, url: string): Promise<AudioBuffer> => {
  const data = await (await fetch(url)).arrayBuffer();
  return new Promise((resolve, reject) => context.decodeAudioData(data, resolve, reject));
};

/** 50ms of 8-bit mono silence as a WAV data URL. */
const SILENCE = ((): string => {
  const sampleRate = 8000;
  const samples = sampleRate / 20;
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string) => [...text].forEach((c, i) => bytes.set([c.charCodeAt(0)], offset + i));
  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples, true);
  ascii(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  ascii(36, "data");
  view.setUint32(40, samples, true);
  bytes.fill(128, 44); // 8-bit silence is mid-scale
  return `data:audio/wav;base64,${btoa(String.fromCharCode(...bytes))}`;
})();
