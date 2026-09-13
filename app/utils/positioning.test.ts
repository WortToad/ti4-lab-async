import { describe, expect, it } from "vitest";
import { generateHexRings } from "./hexCoordinates";
import {
  calculateConcentricCircles,
  calculateMaxHexRadius,
  getHexPosition,
} from "./positioning";

describe("map sizing", () => {
  it.each([2, 3, 4, 5])(
    "fits every tile in a %i-ring galaxy on a phone",
    (rings) => {
      const positions = generateHexRings(rings);
      const actualRings = calculateConcentricCircles(positions.length);
      expect(actualRings).toBe(rings);
      const width = 286;
      const height = 310;
      const gap = Math.min(width, height) * 0.01;
      const radius = calculateMaxHexRadius(actualRings, width, height, gap);
      expect(radius).toBeGreaterThan(0);
      for (const position of positions) {
        const { x, y } = getHexPosition(position.x, position.y, radius, gap);
        expect(Math.abs(x) + radius).toBeLessThanOrEqual(width / 2 + 0.001);
        expect(Math.abs(y) + (Math.sqrt(3) * radius) / 2).toBeLessThanOrEqual(
          height / 2 + 0.001,
        );
      }
    },
  );
});
