import {
  AppShell,
  ActionIcon,
  Box,
  Burger,
  Button,
  Drawer,
  Group,
  Popover,
  Stack,
} from "@mantine/core";
import {
  IconAdjustments,
  IconArrowRight,
  IconMap,
  IconRestore,
} from "@tabler/icons-react";
import { Link, useLocation } from "react-router";
import { useState } from "react";
import { Logo } from "~/components/Logo";
import classes from "./MainAppShell.module.css";

type Props = {
  children: React.ReactNode;
  headerRightSection?: React.ReactNode;
};

export function MainAppShell({ children, headerRightSection }: Props) {
  const [opened, setOpened] = useState(false);
  const { pathname } = useLocation();
  const links = [
    {
      to: "/",
      label: "Draft formats",
      active:
        pathname === "/" ||
        pathname === "/draft/prechoice" ||
        /^\/draft\/(?:[^/]+\/)?new$/.test(pathname),
    },
    {
      to: "/map-generator",
      label: "Map builder",
      active: pathname === "/map-generator",
      icon: IconMap,
    },
    {
      to: "/draft/rejoin",
      label: "Rejoin a draft",
      active: pathname === "/draft/rejoin",
      icon: IconRestore,
    },
  ];
  const navigation = (mobile = false) =>
    links.map(({ to, label, active, icon: Icon }) => (
      <Link
        key={to}
        to={to}
        onClick={() => setOpened(false)}
        aria-current={active ? "page" : undefined}
        className={`${classes.navLink} ${mobile ? classes.mobileLink : ""}`}
      >
        {Icon && <Icon size={20} aria-hidden="true" />}
        {label}
      </Link>
    ));

  return (
    <AppShell header={{ height: 80 }} padding={0}>
      <a className={classes.skipLink} href="#main-content">
        Skip to main content
      </a>
      <AppShell.Header className={classes.header}>
        <div className={classes.headerInner}>
          <Link
            to="/"
            className={classes.brand}
            aria-label="TI4 Draft Command home"
          >
            <Logo />
          </Link>
          <nav className={classes.desktopMenu} aria-label="Main navigation">
            {navigation()}
          </nav>
          <div className={classes.headerActions}>
            {headerRightSection && (
              <Popover position="bottom-end" width={300} withArrow trapFocus>
                <Popover.Target>
                  <ActionIcon
                    variant="default"
                    size={44}
                    aria-label="Display settings"
                  >
                    <IconAdjustments size={21} aria-hidden="true" />
                  </ActionIcon>
                </Popover.Target>
                <Popover.Dropdown p="md">{headerRightSection}</Popover.Dropdown>
              </Popover>
            )}
            <Button
              component={Link}
              to="/#draft-formats"
              size="sm"
              rightSection={<IconArrowRight size={18} aria-hidden="true" />}
            >
              New draft
            </Button>
          </div>
          <Burger
            opened={opened}
            onClick={() => setOpened(!opened)}
            className={classes.burger}
            aria-label={opened ? "Close navigation" : "Open navigation"}
            aria-expanded={opened}
            aria-controls={opened ? "mobile-navigation" : undefined}
          />
        </div>
      </AppShell.Header>
      <Drawer
        opened={opened}
        onClose={() => setOpened(false)}
        position="right"
        size="sm"
        title="Draft Command"
        id="mobile-drawer"
      >
        <Stack gap="lg">
          <nav id="mobile-navigation" aria-label="Mobile navigation">
            <Stack gap="xs">{navigation(true)}</Stack>
          </nav>
          <Button
            component={Link}
            to="/#draft-formats"
            onClick={() => setOpened(false)}
            rightSection={<IconArrowRight size={20} />}
          >
            New draft
          </Button>
          {headerRightSection && (
            <Box className={classes.mobileSettings}>{headerRightSection}</Box>
          )}
        </Stack>
      </Drawer>
      <AppShell.Main id="main-content" tabIndex={-1} className={classes.main}>
        {children}
      </AppShell.Main>
      <footer className={classes.footer}>
        <div className={classes.footerInner}>
          <div>
            <span className={classes.footerBrand}>TI4 Draft Command</span>
            <p>A place to prepare your claim to the galaxy.</p>
          </div>
          <Group gap="xl">
            <Link to="/">Draft formats</Link>
            <Link to="/map-generator">Map builder</Link>
            <Link to="/draft/rejoin">Rejoin a draft</Link>
          </Group>
        </div>
        <p className={classes.credit}>
          An unofficial community tool for Twilight Imperium. Artwork and quoted
          text © Fantasy Flight Games. Inspired by the Guide to the Imperium
          and the TI4 rulebooks.
        </p>
      </footer>
    </AppShell>
  );
}
