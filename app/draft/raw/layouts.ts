import type { RawLayout, RawSettings } from "./types";

const standard = (
  players: number,
  blue: number,
  red: number,
  homes: number[],
  overrides: Partial<RawLayout> = {},
): RawLayout => ({
  id: `standard${players}p`,
  label: `${players} players — standard galaxy`,
  description: `${blue} blue and ${red} red tiles per player.`,
  players,
  blue,
  red,
  rings: 3,
  homes,
  closed: [],
  preset: {},
  ...overrides,
});

// Positions follow the diagrams in LRR 2.0 p. 6 and Thunder's Edge p. 7.
export const RAW_LAYOUTS: Record<string, RawLayout> = {
  standard3p: standard(3, 6, 2, [22, 28, 34], {
    closed: [19, 20, 24, 25, 26, 30, 31, 32, 36],
  }),
  standard4p: standard(4, 5, 3, [23, 27, 32, 36]),
  standard5p: standard(5, 4, 2, [22, 25, 28, 32, 36], {
    extraRed: 1,
    tradeGoods: [2, 4, 2, 0, 0],
    description:
      "4 blue and 2 red tiles per player; the speaker first places 1 extra red tile next to Mecatol. Uneven home positions receive the rulebook's trade goods.",
  }),
  standard6p: standard(6, 3, 2, [19, 22, 25, 28, 31, 34]),
  large6p: standard(6, 6, 3, [37, 41, 45, 49, 53, 57], {
    id: "large6p",
    label: "6 players — large galaxy",
    rings: 4,
  }),
  standard7p: standard(7, 4, 2, [37, 40, 43, 46, 52, 55, 58], {
    rings: 4,
    extraBlue: 3,
    extraRed: 2,
    preset: {
      13: { systemId: "85A" },
      27: { systemId: "88A" },
      29: { systemId: "87A" },
      48: { systemId: "83A" },
      49: { systemId: "86A" },
      50: { systemId: "84A" },
    },
    description:
      "4 blue and 2 red tiles per player; the speaker first places 3 extra blue and 2 extra red tiles next to Mecatol.",
  }),
  standard8p: standard(8, 4, 2, [37, 40, 43, 46, 49, 52, 55, 58], {
    rings: 4,
    extraBlue: 2,
    extraRed: 2,
    description:
      "4 blue and 2 red tiles per player; the speaker first places 2 extra blue and 2 extra red tiles next to Mecatol.",
  }),
  alternate7p: standard(7, 3, 2, [37, 22, 25, 49, 52, 55, 58], {
    id: "alternate7p",
    label: "7 players — alternate galaxy",
    rings: 4,
    closed: [39, 40, 41, 42, 43, 44, 45, 46, 47, 53, 54, 57],
    preset: {
      1: { systemId: "83B" },
      4: { systemId: "84B" },
      5: { systemId: "90B" },
      20: { systemId: "85B" },
      27: { systemId: "86B" },
      33: { systemId: "88B", rotation: 120 },
    },
  }),
  alternate8p: standard(8, 3, 2, [37, 40, 43, 46, 49, 52, 55, 58], {
    id: "alternate8p",
    label: "8 players — alternate galaxy",
    rings: 4,
    closed: [41, 42, 45, 53, 54, 57],
    preset: {
      1: { systemId: "87A", rotation: 60 },
      2: { systemId: "89B", rotation: 180 },
      4: { systemId: "88A", rotation: 120 },
      5: { systemId: "90B" },
      24: { systemId: "83B", rotation: 120 },
      33: { systemId: "85B", rotation: 120 },
    },
  }),
  hyperlane4p: standard(4, 3, 2, [22, 25, 31, 34], {
    id: "hyperlane4p",
    label: "4 players — Thunder's Edge hyperlanes",
    preset: {
      1: { systemId: "85A", rotation: 180 },
      8: { systemId: "87A", rotation: 180 },
      18: { systemId: "88A", rotation: 180 },
      19: { systemId: "86A", rotation: 180 },
      20: { systemId: "84A", rotation: 180 },
      36: { systemId: "83A", rotation: 180 },
      4: { systemId: "121" },
      12: { systemId: "124" },
      14: { systemId: "123" },
      27: { systemId: "119" },
      28: { systemId: "122" },
      29: { systemId: "120" },
    },
  }),
  hyperlane5p: standard(5, 3, 2, [19, 22, 25, 31, 34], {
    id: "hyperlane5p",
    label: "5 players — hyperlanes",
    preset: {
      4: { systemId: "85A" },
      12: { systemId: "88A" },
      14: { systemId: "87A" },
      27: { systemId: "83A" },
      28: { systemId: "86A" },
      29: { systemId: "84A" },
    },
  }),
};

export function getRawLayouts(
  settings: Pick<RawSettings, "players" | "pok" | "te">,
): RawLayout[] {
  const count = settings.players.length;
  if (count < 3 || count > (settings.pok ? 8 : 6)) return [];
  if (count === 4 && settings.te && settings.pok)
    return [RAW_LAYOUTS.hyperlane4p];
  if (count === 5) {
    if (settings.te) {
      const teHyperlanes: Record<string, string> = {
        "83A": "119",
        "84A": "120",
        "85A": "121",
        "86A": "122",
        "87A": "123",
        "88A": "124",
      };
      return [
        {
          ...RAW_LAYOUTS.hyperlane5p,
          preset: Object.fromEntries(
            Object.entries(RAW_LAYOUTS.hyperlane5p.preset).map(
              ([position, tile]) => [
                position,
                {
                  ...tile,
                  systemId: teHyperlanes[tile.systemId],
                },
              ],
            ),
          ),
        },
      ];
    }
    return settings.pok
      ? [RAW_LAYOUTS.standard5p, RAW_LAYOUTS.hyperlane5p]
      : [RAW_LAYOUTS.standard5p];
  }
  if (count === 6 && settings.pok)
    return [RAW_LAYOUTS.standard6p, RAW_LAYOUTS.large6p];
  if ((count === 7 || count === 8) && settings.pok)
    return [
      RAW_LAYOUTS[`standard${count}p`],
      RAW_LAYOUTS[`alternate${count}p`],
    ];
  return [RAW_LAYOUTS[`standard${count}p`]];
}
