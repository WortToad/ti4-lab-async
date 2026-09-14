import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Select,
  SimpleGrid,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import {
  IconArrowDown,
  IconArrowRight,
  IconBook2,
  IconCards,
  IconCrown,
  IconDna2,
  IconHexagons,
  IconMap,
  IconPlanet,
  IconRestore,
  IconSearch,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { MainAppShell } from "~/components/MainAppShell";
import {
  DRAFT_MODES,
  modeSetupUrl,
  type DraftModeEntry,
} from "~/data/draftModes";
import { parseLobbyPlayerCount } from "~/draft/lobbySetup";
import { appPath } from "~/utils/appUrl";
import classes from "~/components/Home.module.css";

export const meta = () => [
  { title: "TI4 Foundry · Mecatol Rex awaits" },
  {
    name: "description",
    content:
      "Choose your Twilight Imperium draft. Milty, Nucleus, Texas, Mantis, Franken, Twilight’s Fall and official setup — one shared lobby for your table.",
  },
];

const icons = {
  slices: IconHexagons,
  orbit: IconPlanet,
  map: IconMap,
  cards: IconCards,
  crown: IconCrown,
  dna: IconDna2,
  book: IconBook2,
};

function ModeCard({
  mode,
  players,
}: {
  mode: DraftModeEntry;
  players: number;
}) {
  const Icon = icons[mode.icon];
  const adjusted = players < mode.minPlayers || players > mode.maxPlayers;
  const range =
    mode.minPlayers === mode.maxPlayers
      ? String(mode.minPlayers)
      : `${mode.minPlayers}–${mode.maxPlayers}`;
  return (
    <article
      className={classes.modeCard}
      data-recommended={mode.recommended || undefined}
      data-twilight={mode.group === "twilight" || undefined}
    >
      <div className={classes.cardTop}>
        <Icon size={30} stroke={1.4} aria-hidden="true" />
        {mode.recommended ? (
          <span className={classes.recommendation}>Start here</span>
        ) : (
          <span className={classes.playerRange}>
            <IconUsers size={18} aria-hidden="true" />
            {range} players
          </span>
        )}
      </div>
      <Title order={3}>{mode.title}</Title>
      <Text className={classes.cardDescription}>{mode.description}</Text>
      <span className={classes.cardDetail}>
        {mode.detail}
        {mode.recommended && ` · ${range} players`}
      </span>
      <Link
        className={classes.cardLink}
        to={modeSetupUrl(mode, players)}
        aria-label={`Set up ${mode.title}${adjusted ? ` for ${Math.min(mode.maxPlayers, Math.max(mode.minPlayers, players))} players` : ""}`}
      >
        <span>
          {adjusted
            ? `Set up for ${Math.min(mode.maxPlayers, Math.max(mode.minPlayers, players))} players`
            : `Set up ${mode.title === "Rules as written" ? "RAW" : mode.title}`}
        </span>
        <IconArrowRight size={21} aria-hidden="true" />
      </Link>
    </article>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const searchTerms = query
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .split(/\s+/)
    .filter(Boolean);
  const matchingModes = DRAFT_MODES.filter((mode) => {
    const searchable =
      `${mode.id} ${mode.title} ${mode.description} ${mode.detail}`
        .toLowerCase()
        .replace(/[’']/g, "");
    return searchTerms.every((term) => searchable.includes(term));
  });
  const [params, setParams] = useSearchParams();
  const players = parseLobbyPlayerCount(params.get("playerCount"), 2, 8);
  const changePlayers = (value: string | null) => {
    if (!value) return;
    const next = new URLSearchParams(params);
    next.set("playerCount", value);
    setParams(next, { replace: true, preventScrollReset: true });
  };
  return (
    <MainAppShell>
      <div className={classes.home}>
        <section className={classes.hero} aria-labelledby="hero-title">
          <img
            className={classes.heroArt}
            src={appPath("/art/imperial-starfield.jpeg")}
            alt=""
            fetchPriority="high"
          />
          <div className={classes.heroVeil} />
          <div className={classes.heroContent}>
            <div className={classes.heroEyebrow}>
              <span />
              Twilight Imperium · Drafting &amp; galaxy building
            </div>
            <h1 id="hero-title">
              Mecatol Rex
              <br />
              <em>awaits.</em>
            </h1>
            <p className={classes.heroDescription}>
              The Lazax empire has fallen. Its throne endures. Across the
              galaxy, the Great Races muster fleets and bargain for allies.
              Choose your draft, gather your rivals, and decide who will lay
              claim to Mecatol Rex.
            </p>
            <Group gap="md" mt={28}>
              <Button
                component="a"
                href="#draft-formats"
                size="lg"
                rightSection={<IconArrowDown size={21} aria-hidden="true" />}
              >
                Choose a draft
              </Button>
              <Button
                component={Link}
                to="/draft/rejoin"
                variant="outline"
                color="gray.2"
                size="lg"
                leftSection={<IconRestore size={20} aria-hidden="true" />}
              >
                Rejoin your table
              </Button>
            </Group>
            <div className={classes.heroNote}>
              <IconUsers size={18} aria-hidden="true" />
              One shared link. Every player at the table.
            </div>
          </div>
        </section>

        <div className={classes.briefing}>
          <div className={classes.briefingLabel}>
            <IconCrown size={27} stroke={1.4} aria-hidden="true" />
            <span>
              Echoes of
              <br />
              the Imperium
            </span>
          </div>
          <blockquote cite="https://www.fantasyflightgames.com/en/news/2017/8/15/the-age-of-twilight/">
            “The day will soon come when a new Empire will rise.”
            <cite>
              Mahthom Iq Seerva ·{" "}
              <a href="https://www.fantasyflightgames.com/en/news/2017/8/15/the-age-of-twilight/">
                The Age of Twilight
              </a>
            </cite>
          </blockquote>
        </div>

        <section
          id="draft-formats"
          className={classes.catalog}
          aria-labelledby="formats-title"
        >
          <div className={classes.catalogHeading}>
            <div>
              <Text className="command-eyebrow" mb={10}>
                01 / The Great Races gather
              </Text>
              <Title order={2} id="formats-title">
                The contest for the throne
              </Title>
              <Text c="dimmed" mt={8}>
                Every format, at a glance. Choose one to configure your draft
                and create a lobby.
              </Text>
            </div>
          </div>
          <div className={classes.catalogToolbar}>
            <TextInput
              label="Find a draft format"
              placeholder="Search Milty, Franken, Twilight’s Fall…"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setQuery("");
              }}
              leftSection={<IconSearch size={20} aria-hidden="true" />}
              rightSection={
                query ? (
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    aria-label="Clear format search"
                    onClick={() => setQuery("")}
                  >
                    <IconX size={18} aria-hidden="true" />
                  </ActionIcon>
                ) : undefined
              }
              aria-controls="draft-results"
            />
            <Select
              label="Players at your table"
              aria-label="Players at your table"
              value={String(players)}
              onChange={changePlayers}
              allowDeselect={false}
              leftSection={<IconUsers size={20} aria-hidden="true" />}
              data={[2, 3, 4, 5, 6, 7, 8].map((n) => ({
                value: String(n),
                label: `${n} players`,
              }))}
              className={classes.playerSelect}
            />
          </div>
          <div id="draft-results">
            {searchTerms.length > 0 ? (
              <section
                className={classes.searchResults}
                aria-label="Matching draft formats"
              >
                <div className={classes.searchSummary}>
                  <Text c="dimmed" role="status">
                    {matchingModes.length}{" "}
                    {matchingModes.length === 1 ? "format" : "formats"} matching
                    “{query.trim()}”
                  </Text>
                  <Button
                    variant="subtle"
                    size="sm"
                    onClick={() => setQuery("")}
                  >
                    Show all formats
                  </Button>
                </div>
                {matchingModes.length > 0 ? (
                  <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                    {matchingModes.map((mode) => (
                      <ModeCard key={mode.id} mode={mode} players={players} />
                    ))}
                  </SimpleGrid>
                ) : (
                  <div className={classes.emptySearch}>
                    <IconSearch size={32} stroke={1.5} aria-hidden="true" />
                    <Title order={3}>No formats found</Title>
                    <Text c="dimmed">
                      Try a format name or a keyword like “factions” or “bags”.
                    </Text>
                  </div>
                )}
              </section>
            ) : (
              <>
                <nav
                  className={classes.catalogNav}
                  aria-label="Draft categories"
                >
                  <a href="#classic-drafts">
                    Galaxy drafts{" "}
                    <span>
                      {String(
                        DRAFT_MODES.filter((m) => m.group === "classic").length,
                      ).padStart(2, "0")}
                    </span>
                  </a>
                  <a href="#custom-drafts">
                    Bag &amp; Franken{" "}
                    <span>
                      {String(
                        DRAFT_MODES.filter((m) => m.group === "custom").length,
                      ).padStart(2, "0")}
                    </span>
                  </a>
                  <a href="#twilight-drafts">
                    Twilight’s Fall{" "}
                    <span>
                      {String(
                        DRAFT_MODES.filter((m) => m.group === "twilight")
                          .length,
                      ).padStart(2, "0")}
                    </span>
                  </a>
                </nav>
                <section
                  id="classic-drafts"
                  className={classes.modeSection}
                  aria-labelledby="classic-title"
                >
                  <div className={classes.sectionHeading}>
                    <div>
                      <span className={classes.sectionNumber}>I</span>
                      <Title order={2} id="classic-title">
                        Heirs to the Lazax
                      </Title>
                    </div>
                    <Text>
                      Ancient rivalries. Fragile alliances. One imperial throne.
                    </Text>
                  </div>
                  <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                    {DRAFT_MODES.filter((m) => m.group === "classic").map(
                      (mode) => (
                        <ModeCard key={mode.id} mode={mode} players={players} />
                      ),
                    )}
                  </SimpleGrid>
                </section>
                <section
                  id="custom-drafts"
                  className={classes.modeSection}
                  aria-labelledby="custom-title"
                >
                  <div className={classes.sectionHeading}>
                    <div>
                      <span className={classes.sectionNumber}>II</span>
                      <Title order={2} id="custom-title">
                        Powers yet unknown
                      </Title>
                    </div>
                    <Text>
                      Bind the strengths of rival civilizations into a faction
                      the Galactic Council has never faced.
                    </Text>
                  </div>
                  <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                    {DRAFT_MODES.filter((m) => m.group === "custom").map(
                      (mode) => (
                        <ModeCard key={mode.id} mode={mode} players={players} />
                      ),
                    )}
                  </SimpleGrid>
                </section>
                <section
                  id="twilight-drafts"
                  className={`${classes.modeSection} ${classes.twilightSection}`}
                  aria-labelledby="twilight-title"
                >
                  <div className={classes.twilightIntro}>
                    <div>
                      <Text className="command-eyebrow" c="magenta.2" mb={10}>
                        Pax mortuus bellum aeternus
                      </Text>
                      <Title order={2} id="twilight-title">
                        Twilight’s Fall
                      </Title>
                      <Text mt="sm" c="dimmed">
                        In this dark future, the Great Races have fallen. The
                        Mahact kings claim their stolen strengths and turn them
                        against one another.
                      </Text>
                    </div>
                    <Badge color="magenta" variant="outline" size="lg">
                      Requires Twilight’s Fall
                    </Badge>
                  </div>
                  <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                    {DRAFT_MODES.filter((m) => m.group === "twilight").map(
                      (mode) => (
                        <ModeCard key={mode.id} mode={mode} players={players} />
                      ),
                    )}
                  </SimpleGrid>
                  <Text size="xs" c="dimmed" mt="md">
                    “Pax mortuus bellum aeternus” · Twilight’s Fall rulebook,
                    cover.
                  </Text>
                </section>
              </>
            )}
          </div>
        </section>

        <section className={classes.nextSteps} aria-labelledby="next-title">
          <div>
            <Text className="command-eyebrow" mb={10}>
              02 / Before the first fleet sails
            </Text>
            <Title order={2} id="next-title">
              Convene the rival powers
            </Title>
          </div>
          <ol className={classes.steps}>
            <li>
              <span>01</span>
              <div>
                <h3>Prepare your draft</h3>
                <p>
                  Choose a format, set your player count, and select the content
                  your table owns.
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Share the lobby</h3>
                <p>
                  Send one link to your group. Each player joins with their own
                  name.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Begin the struggle</h3>
                <p>
                  Start when everyone is ready. Complete the draft, then bring
                  the struggle for the throne to your table.
                </p>
              </div>
            </li>
          </ol>
        </section>
        <section className={classes.mapCta} aria-labelledby="map-title">
          <IconMap size={42} stroke={1.3} aria-hidden="true" />
          <div>
            <Title order={2} id="map-title" size="h3">
              Chart the road to Mecatol Rex
            </Title>
            <Text c="dimmed" mt={6}>
              Place the worlds your fleets will defend and your rivals will
              covet. Generate, edit, and share a map before choosing your draft.
            </Text>
          </div>
          <Button
            component={Link}
            to="/map-generator"
            variant="outline"
            rightSection={<IconArrowRight size={20} aria-hidden="true" />}
          >
            Open map builder
          </Button>
        </section>
      </div>
    </MainAppShell>
  );
}
