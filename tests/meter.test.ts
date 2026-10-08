import { describe, expect, test } from "bun:test";
import { createMeter, resetMeter, setHighScore, updateMeter } from "../src/meter";

const px = (score: number) => score / 0.025; // distance in px that shows as `score`
const shown = (digits: string[]) => digits.join("");

describe("meter", () => {
  test("shows five zero-padded digits and sits 66px in from the right edge", () => {
    const meter = createMeter(600);
    expect(meter.digits).toEqual(["0", "0", "0", "0", "0"]);
    expect(meter.x).toBe(600 - 11 * 6);
  });

  test("converts distance to score at 0.025 points per pixel, rounded", () => {
    const meter = createMeter(600);
    updateMeter(meter, 16, px(42));
    expect(shown(meter.digits)).toBe("00042");
    updateMeter(meter, 16, px(1234) + 10); // 1234.25 rounds down
    expect(shown(meter.digits)).toBe("01234");
  });

  test("grows a sixth digit past 99999 without moving", () => {
    const meter = createMeter(600);
    updateMeter(meter, 16, px(100000));
    expect(shown(meter.digits)).toBe("100000");
    expect(meter.x).toBe(600 - 11 * 6); // the layout always reserves one spare slot
  });

  test("every hundred points: reports the milestone once and flashes the frozen score for 2 s", () => {
    const meter = createMeter(600);
    expect(updateMeter(meter, 16, px(99))).toBe(false);
    expect(updateMeter(meter, 16, px(100))).toBe(true);
    expect(shown(meter.digits)).toBe("00100");

    const visibility: boolean[] = [];
    for (let step = 1; step <= 20; step++) {
      updateMeter(meter, 100, px(100 + step));
      visibility.push(meter.visible);
    }
    // hidden for 250ms then shown; the timer rolls over once it passes 500ms, so 600ms per cycle at this step size
    const cycle = [false, false, true, true, true, true];
    expect(visibility).toEqual([...cycle, ...cycle, ...cycle, false, false]);
    expect(shown(meter.digits)).toBe("00100");
    for (let step = 21; step <= 26; step++) updateMeter(meter, 100, px(100 + step));
    expect(meter.visible).toBe(true);
    expect(shown(meter.digits)).toBe("00126");
  });

  test("keeps a HI prefix in front of the best score", () => {
    const meter = createMeter(600);
    expect(meter.highScore).toEqual([]);
    setHighScore(meter, px(562));
    expect(meter.highScore).toEqual(["10", "11", "", "0", "0", "5", "6", "2"]); // 10 = H, 11 = I in the glyph strip
  });

  test("reset keeps the high score but clears the running score", () => {
    const meter = createMeter(600);
    updateMeter(meter, 16, px(300));
    setHighScore(meter, px(300));
    resetMeter(meter);
    expect(shown(meter.digits)).toBe("00000");
    expect(shown(meter.highScore.slice(3))).toBe("00300");
  });
});
