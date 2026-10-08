import { OBSTACLES, TREX } from "./config";
import { boxesIntersect, offsetBox } from "./geometry";
import type { Obstacle } from "./obstacle";
import { trexHitBoxes, type Trex } from "./trex";
import type { Box } from "./types";

/**
 * A cheap outer-box test, then the sprites' hit boxes.
 * Returns the pair of hit boxes that overlap, or null.
 */
export function checkForCollision(obstacle: Obstacle, trex: Trex): [Box, Box] | null {
  const trexBox: Box = { x: trex.x + 1, y: trex.y + 1, width: TREX.width - 2, height: TREX.height - 2 };
  const obstacleBox: Box = { x: obstacle.x + 1, y: obstacle.y + 1, width: obstacle.width - 2, height: OBSTACLES[obstacle.kind].height - 2 };
  if (!boxesIntersect(trexBox, obstacleBox)) return null;
  for (const t of trexHitBoxes(trex)) {
    for (const o of obstacle.hitBoxes) {
      const a = offsetBox(t, trexBox);
      const b = offsetBox(o, obstacleBox);
      if (boxesIntersect(a, b)) return [a, b];
    }
  }
  return null;
}
