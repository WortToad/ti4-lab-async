import {
  Badge,
  Button,
  Group,
  Select,
  SimpleGrid,
  Text,
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
  IconUsers,
} from "@tabler/icons-react";
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
  { title: "TI4 Draft Command · Your claim begins here" },
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
            <IconUsers size={16} aria-hidden="true" />
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
              Your claim
              <br />
              begins <em>here.</em>
            </h1>
            <p className={classes.heroDescription}>
              Before the first command token is placed, an empire takes shape.
              Choose your draft, gather your table, and carve out your corner of
              the galaxy.
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
          <div className={classes.orbitalCaption} aria-hidden="true">
            <span>Imperial cartography / 001</span>
            <strong>The galaxy awakens</strong>
            <span>Guide to the Imperium</span>
          </div>
        </section>

        <div className={classes.briefing}>
          <div className={classes.briefingLabel}>
            <IconCrown size={27} stroke={1.4} aria-hidden="true" />
            <span>
              The throne
              <br />
              stands empty
            </span>
          </div>
          <blockquote>
            “But who among the races of the galaxy could fill the void left by
            the Lazax?”
            <cite>Guide to the Imperium · The Galaxy Awakens, p. 52</cite>
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
                01 / Assemble your table
              </Text>
              <Title order={2} id="formats-title">
                Choose how your empire begins
              </Title>
              <Text c="dimmed" mt={8}>
                Every format, at a glance. Choose one to configure your draft
                and create a lobby.
              </Text>
            </div>
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
              w={190}
              className={classes.playerSelect}
            />
          </div>
          <nav className={classes.catalogNav} aria-label="Draft categories">
            <a href="#classic-drafts">
              Galaxy drafts <span>09</span>
            </a>
            <a href="#custom-drafts">
              Bag &amp; Franken <span>08</span>
            </a>
            <a href="#twilight-drafts">
              Twilight’s Fall <span>04</span>
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
                  A galaxy to claim
                </Title>
              </div>
              <Text>Factions, systems, and your place at the table.</Text>
            </div>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
              {DRAFT_MODES.filter((m) => m.group === "classic").map((mode) => (
                <ModeCard key={mode.id} mode={mode} players={players} />
              ))}
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
                  An empire of your own
                </Title>
              </div>
              <Text>
                Pass the bags. Keep your picks. Assemble something formidable.
              </Text>
            </div>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
              {DRAFT_MODES.filter((m) => m.group === "custom").map((mode) => (
                <ModeCard key={mode.id} mode={mode} players={players} />
              ))}
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
                  The Mahact kings return. Rebuild your faction from the
                  remnants of a fallen galaxy.
                </Text>
              </div>
              <Badge color="magenta" variant="outline" size="lg">
                Requires Twilight’s Fall
              </Badge>
            </div>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
              {DRAFT_MODES.filter((m) => m.group === "twilight").map((mode) => (
                <ModeCard key={mode.id} mode={mode} players={players} />
              ))}
            </SimpleGrid>
            <Text size="xs" c="dimmed" mt="md">
              “Pax mortuus bellum aeternus” · Twilight’s Fall rulebook, cover.
            </Text>
          </section>
        </section>

        <section className={classes.nextSteps} aria-labelledby="next-title">
          <div>
            <Text className="command-eyebrow" mb={10}>
              02 / From draft to first turn
            </Text>
            <Title order={2} id="next-title">
              Gather the great powers
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
                <h3>Make your claim</h3>
                <p>
                  Start when everyone is ready. Follow the draft, then take your
                  galaxy to the table.
                </p>
              </div>
            </li>
          </ol>
        </section>
        <section className={classes.mapCta} aria-labelledby="map-title">
          <IconMap size={42} stroke={1.3} aria-hidden="true" />
          <div>
            <Title order={2} id="map-title" size="h3">
              Prefer to chart your own galaxy?
            </Title>
            <Text c="dimmed" mt={6}>
              Generate, edit, and share a map before choosing your draft.
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
