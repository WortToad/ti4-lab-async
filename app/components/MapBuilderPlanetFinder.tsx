import { System } from "~/types";
import { useMapBuilder } from "~/mapBuilderStore";
import { PlanetFinderBase } from "~/components/PlanetFinder";
import { useMemo } from "react";

type Props = {
  onSystemSelected?: (system: System) => void;
};

export function MapBuilderPlanetFinder({ onSystemSelected }: Props) {
  const planetFinderModal = useMapBuilder((state) => state.planetFinderModal);
  const availableSystemIds = useMapBuilder((state) => state.systemPool);
  const map = useMapBuilder((state) => state.state.map);
  const usedSystemIds = useMemo(
    () =>
      map.flatMap((tile) => (tile.type === "SYSTEM" ? [tile.systemId] : [])),
    [map],
  );
  const factionPool = useMapBuilder((state) => state.factionPool);
  const allowHomePlanetSearch = useMapBuilder(
    (state) => state.draft.settings.allowHomePlanetSearch,
  );
  const { addSystemToMap, closePlanetFinder } = useMapBuilder(
    (state) => state.actions,
  );

  const handleSelectSystem = (system: System) => {
    if (!planetFinderModal) return;

    if (planetFinderModal.mode === "map") {
      addSystemToMap(planetFinderModal.tileIdx, system.id, system.rotation);
    }

    onSystemSelected?.(system);
    closePlanetFinder();
  };

  return (
    <PlanetFinderBase
      opened={!!planetFinderModal}
      onClose={closePlanetFinder}
      onSystemSelected={handleSelectSystem}
      availableSystemIds={availableSystemIds}
      usedSystemIds={usedSystemIds}
      factionPool={factionPool}
      allowHomePlanetSearch={allowHomePlanetSearch}
    />
  );
}
