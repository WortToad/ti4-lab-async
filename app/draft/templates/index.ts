import { mapStringOrder } from "~/data/mapStringOrder";
import type { SystemId } from "~/types";
import { coreGenerateMap } from "../common/sliceGenerator";
import { generateTemplateNucleusSlices } from "./nucleusSlices";
import { generateSlices as generateMiltySlices } from "../milty/sliceGenerator";
import type { DraftConfig, DraftType } from "../types";
import botLayouts from "./botLayouts.json";

type Template = {
  alias: string;
  playerCount: number;
  templateTiles: {
    pos: string;
    staticTileId?: string;
    playerNumber?: number;
    home?: boolean;
    miltyTileIndex?: number;
    nucleusNumbers?: number[];
  }[];
};

export function botPositionToIndex(position: string): number {
  const ring = Number(position[0]);
  return ring === 0 ? 0 : 3 * (ring - 1) * ring + Number(position.slice(1));
}

function templateConfig(type: DraftType, template: Template): DraftConfig {
  const nucleus = type.startsWith("heisen");
  const generateSlices = nucleus
    ? generateTemplateNucleusSlices
    : generateMiltySlices;
  const mapSize = template.templateTiles.some((tile) => tile.pos[0] === "4")
    ? 4
    : 3;
  const homes = template.templateTiles
    .filter((tile) => tile.home)
    .sort((a, b) => a.playerNumber! - b.playerNumber!);
  const homeIdxInMapString = homes.map((tile) => botPositionToIndex(tile.pos));
  const presetTiles: DraftConfig["presetTiles"] = {};
  const modifiableMapTiles: number[] = [];
  const seatTilePlacement: DraftConfig["seatTilePlacement"] = {};
  const occupied = new Set<number>();
  for (const tile of template.templateTiles) {
    const index = botPositionToIndex(tile.pos);
    if (tile.staticTileId === "-1") continue;
    occupied.add(index);
    if (tile.nucleusNumbers?.length) modifiableMapTiles.push(index);
    if (tile.staticTileId && index !== 0) {
      const match = /^(\d+[aAbB])(\d)$/.exec(tile.staticTileId);
      presetTiles[index] = match
        ? {
            systemId: match[1].toUpperCase() as SystemId,
            rotation: Number(match[2]) * 60,
          }
        : { systemId: tile.staticTileId as SystemId };
    }
    if (tile.playerNumber !== undefined && tile.miltyTileIndex !== undefined) {
      const seat = tile.playerNumber - 1;
      const home = mapStringOrder[homeIdxInMapString[seat]];
      const position = mapStringOrder[index];
      seatTilePlacement[seat] ??= [];
      seatTilePlacement[seat][tile.miltyTileIndex] = [
        position.x - home.x,
        position.y - home.y,
      ];
    }
  }
  const numTiles = 1 + 3 * mapSize * (mapSize + 1);
  return {
    type,
    numPlayers: template.playerCount,
    mapSize,
    numSystemsInSlice: nucleus ? 3 : 5,
    sliceHeight: nucleus ? 2 : 3,
    sliceConcentricCircles: 1,
    mecatolPathSystemIndices: nucleus ? [1] : [1, 4],
    homeIdxInMapString,
    presetTiles,
    modifiableMapTiles,
    closedMapTiles: Array.from(
      { length: numTiles },
      (_, index) => index,
    ).filter((index) => !occupied.has(index)),
    seatTilePositions: [
      { x: 0, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: -1 },
      { x: 1, y: -1 },
      ...(nucleus
        ? []
        : [
            { x: -1, y: -1 },
            { x: 0, y: -2 },
          ]),
    ],
    seatTilePlacement,
    generateSlices,
    generateMap: (settings, systemPool, minorFactionPool) =>
      coreGenerateMap(
        settings,
        systemPool,
        0,
        generateSlices,
        minorFactionPool,
      ),
  };
}

export const milty3p = templateConfig("milty3p", botLayouts.milty3p);
export const heisen3p = templateConfig("heisen3p", botLayouts.heisen3p);
export const heisen4p = templateConfig("heisen4p", botLayouts.heisen4p);
export const heisen5p = templateConfig("heisen5p", botLayouts.heisen5p);
export const heisen7p = templateConfig("heisen7p", botLayouts.heisen7p);
