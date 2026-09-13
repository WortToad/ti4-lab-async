import { MantineProvider } from "@mantine/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { draftConfig } from "~/draft/draftConfig";
import { generateEmptyMap } from "~/utils/map";
import { getPlaceableTileIndices } from "~/utils/texasMapBuild";
import { Map, MAP_INTERACTIONS, type MapInteractions } from "./Map";

describe("draft map placement controls", () => {
  it.each(Object.values(draftConfig))(
    "exposes only legal placements on $type, including when drag and drop is disabled",
    (config) => {
      const map = generateEmptyMap(config);
      const legal = getPlaceableTileIndices(map, ["19", "20"], "19");
      expect(legal.length).toBeGreaterThan(0);
      function render(interactions: MapInteractions, disabled = false) {
        return renderToStaticMarkup(
          <MantineProvider>
            <Map
              id="placement-test"
              map={map}
              modifiableMapTiles={legal}
              interactions={interactions}
              disabled={disabled}
              onSelectSystemTile={() => undefined}
            />
          </MantineProvider>,
        );
      }
      // Texas permits dragging; Mantis uses the same placement rules with
      // clicking/tapping only. RAW also exposes the legal positions as buttons.
      for (const interactions of [
        MAP_INTERACTIONS.texasBuild,
        { ...MAP_INTERACTIONS.texasBuild, droppable: false },
        {
          ...MAP_INTERACTIONS.draftBuild,
          allowSystemSelect: false,
          allowSystemDelete: false,
        },
      ]) {
        const html = render(interactions);
        const positions = [
          ...html.matchAll(/aria-label="Add system at position (\d+)"/g),
        ].map((match) => Number(match[1]));
        expect(positions).toEqual(legal);
        expect(html).not.toMatch(/aria-label="(?:Replace|Remove) system/);
        expect(html).not.toContain('aria-label="Choose seat');
        expect(render(interactions, true)).not.toContain(
          'class="tile-edit-target"',
        );
      }
      expect(render(MAP_INTERACTIONS.readonly)).not.toContain(
        'class="tile-edit-target"',
      );
    },
  );
});
