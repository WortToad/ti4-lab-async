import { BAG_VARIANTS } from "~/draft/bag/rules";

export type DraftModeEntry = {
  id: string;
  title: string;
  description: string;
  detail: string;
  href: string;
  group: "classic" | "custom" | "twilight";
  minPlayers: number;
  maxPlayers: number;
  icon: "slices" | "orbit" | "map" | "cards" | "crown" | "dna" | "book";
  recommended?: boolean;
};

export const DRAFT_MODES: DraftModeEntry[] = [
  {
    id: "milty",
    title: "Milty",
    description:
      "Draft a faction, a five-system slice, and a seat in snake order. Your slice includes the left equidistant system.",
    detail: "The familiar starting point",
    href: "/draft/prechoice?format=milty",
    group: "classic",
    minPlayers: 3,
    maxPlayers: 8,
    icon: "slices",
    recommended: true,
  },
  {
    id: "miltyeq",
    title: "Milty EQ",
    description:
      "Milty with the border systems already on the map. Draft your slice around shared equidistants and contested territory.",
    detail: "Preset equidistants · large 7P option",
    href: "/draft/prechoice?format=miltyeq",
    group: "classic",
    minPlayers: 4,
    maxPlayers: 8,
    icon: "orbit",
  },
  {
    id: "nucleus",
    title: "Nucleus",
    description:
      "Build around a central galactic nucleus. Draft your seat and speaker order separately for more control over your position.",
    detail: "Seat and speaker are separate picks",
    href: "/draft/prechoice?format=nucleus",
    group: "classic",
    minPlayers: 3,
    maxPlayers: 8,
    icon: "orbit",
  },
  {
    id: "texas",
    title: "Texas Style",
    description:
      "Ban factions, choose from a private faction hand, then pass and pick system tiles before building the galaxy.",
    detail: "Random seating · simultaneous choices",
    href: "/draft/prechoice?format=texas",
    group: "classic",
    minPlayers: 3,
    maxPlayers: 8,
    icon: "cards",
  },
  {
    id: "mantis",
    title: "Mantis",
    description:
      "Draft individual systems, factions, and speaker positions. Build your map with random tile draws and limited mulligans.",
    detail: "Draft tiles · discard · build",
    href: "/draft/mantis/new",
    group: "classic",
    minPlayers: 4,
    maxPlayers: 8,
    icon: "map",
  },
  {
    id: "minimilty",
    title: "Mini-Milty",
    description:
      "Start with a complete galaxy, then draft a faction and speaker position in two rounds. Everything uses the base game.",
    detail: "Base game · two-round draft",
    href: "/draft/minimilty/new",
    group: "classic",
    minPlayers: 3,
    maxPlayers: 6,
    icon: "slices",
  },
  {
    id: "raw",
    title: "Rules as written",
    description:
      "Choose factions and take turns placing systems from private hands. Build the galaxy using the official setup rules.",
    detail: "Official TI4 galaxy construction",
    href: "/draft/raw/new?mode=base",
    group: "classic",
    minPlayers: 3,
    maxPlayers: 8,
    icon: "book",
  },
  {
    id: "small",
    title: "4-player Small",
    description:
      "A compact four-player galaxy with smaller slices and less room between empires. Draft factions and your starting position.",
    detail: "A tighter map for four",
    href: "/draft/prechoice?format=small",
    group: "classic",
    minPlayers: 4,
    maxPlayers: 4,
    icon: "map",
  },
  {
    id: "multidraft",
    title: "Multidraft",
    description:
      "Prepare several lobbies with the same settings. Preview the candidate maps before your group chooses where to play.",
    detail: "Multiple drafts · one configuration",
    href: "/draft/prechoice?format=multidraft",
    group: "classic",
    minPlayers: 3,
    maxPlayers: 8,
    icon: "slices",
  },
  ...BAG_VARIANTS.filter(
    ({ id }) => id !== "twilights_fall" && id !== "inaugural_splice",
  ).map(
    ({ id, name, description }): DraftModeEntry => ({
      id,
      title: name,
      description,
      detail:
        id === "standard_bag_draft"
          ? "Pass bags · collect systems"
          : "Pass bags · assemble your faction",
      href: `/draft/bag/new?variant=${id}`,
      group: "custom",
      minPlayers: 2,
      maxPlayers: 8,
      icon: id === "standard_bag_draft" ? "cards" : "dna",
    }),
  ),
  {
    id: "twilight-raw",
    title: "Official starting draft",
    description:
      "Pass faction reference cards, reveal priority, build the galaxy, choose a Mahact king, and perform the inaugural splice.",
    detail: "Twilight’s Fall · rules as written",
    href: "/draft/raw/new?mode=twilightsFall",
    group: "twilight",
    minPlayers: 3,
    maxPlayers: 8,
    icon: "book",
  },
  {
    id: "twilight-packs",
    title: "Reference card packs",
    description:
      "Snake-draft slices, kings, and reference packs. Choose your home system, faction, and priority from your drafted pack.",
    detail: "Twilight’s Fall · slice draft",
    href: "/draft/prechoice?format=twilight",
    group: "twilight",
    minPlayers: 3,
    maxPlayers: 8,
    icon: "crown",
  },
  {
    id: "twilights_fall",
    title: "Bag Draft of Everything",
    description:
      "Pass bags of kings, abilities, genomes, units, homes, fleets, systems, and speaker order. Assemble your faction, then build.",
    detail: "Twilight’s Fall · custom factions",
    href: "/draft/bag/new?variant=twilights_fall",
    group: "twilight",
    minPlayers: 2,
    maxPlayers: 8,
    icon: "dna",
  },
  {
    id: "inaugural_splice",
    title: "Inaugural Splice",
    description:
      "Pick from seven-card bags, then keep two abilities, one genome, and one unit upgrade. Use a separately prepared map.",
    detail: "Twilight’s Fall · opening splice only",
    href: "/draft/bag/new?variant=inaugural_splice",
    group: "twilight",
    minPlayers: 2,
    maxPlayers: 8,
    icon: "cards",
  },
];

export function modeSetupUrl(mode: DraftModeEntry, count: number) {
  const [path, query] = mode.href.split("?");
  const params = new URLSearchParams(query);
  params.set(
    "playerCount",
    String(Math.min(mode.maxPlayers, Math.max(mode.minPlayers, count))),
  );
  return `${path}?${params}`;
}
