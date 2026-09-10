import { expect, test } from "vitest";
import { factions } from "~/data/factionData";
import { rawReferenceCardPool, rawReferenceFaction } from "./referenceCards";

test("no-PoK starting fleets omit unavailable mechs without changing reference cards or shared data", () => {
  const originalFleet = structuredClone(factions.naazrokha.fleetComposition);
  const normal = rawReferenceFaction("naazrokha");
  const withoutPok = rawReferenceFaction("naazrokha", false);
  expect(normal.fleetComposition?.mech).toBe(1);
  expect(withoutPok.fleetComposition).toEqual({
    carrier: 2,
    destroyer: 1,
    infantry: 3,
    fighter: 2,
    spacedock: 1,
  });
  expect(withoutPok.id).toBe(normal.id);
  expect(withoutPok.priorityOrder).toBe(normal.priorityOrder);
  expect(factions.naazrokha.fleetComposition).toEqual(originalFleet);
  expect(rawReferenceCardPool).toHaveLength(30);
  expect(rawReferenceCardPool).toContain("naazrokha");
  expect(rawReferenceCardPool).toContain("keleres");
  expect(rawReferenceFaction("keleres", false).fleetComposition).toEqual(
    rawReferenceFaction("keleres").fleetComposition,
  );
});
