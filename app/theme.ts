import {
  ActionIcon,
  Accordion,
  Alert,
  Badge,
  Button,
  Checkbox,
  Drawer,
  createTheme,
  defaultVariantColorsResolver,
  Input,
  InputBase,
  Modal,
  MultiSelect,
  NumberInput,
  Paper,
  parseThemeColor,
  Radio,
  SegmentedControl,
  Switch,
  Tabs,
  Title,
  Tooltip,
} from "@mantine/core";

/** Navy and chart blue with the selected Golden yellow accent. */
export const commandTheme = createTheme({
  primaryColor: "imperial",
  primaryShade: 4,
  autoContrast: true,
  luminanceThreshold: 0.2,
  black: "#071321",
  white: "#f4f7fb",
  defaultRadius: "sm",
  radius: { xs: "4px", sm: "8px", md: "12px", lg: "16px", xl: "24px" },
  cursorType: "pointer",
  respectReducedMotion: true,
  variantColorResolver: (input) => {
    const resolved = defaultVariantColorsResolver(input);
    // Keep semantic labels saturated instead of using Mantine's pale dark-mode tints.
    if (["light", "subtle", "transparent"].includes(input.variant)) {
      const parsed = parseThemeColor({
        color: input.color ?? input.theme.primaryColor,
        theme: input.theme,
      });
      if (parsed.isThemeColor && parsed.shade === undefined) {
        const shade = ["gray", "dark"].includes(parsed.color)
          ? 3
          : parsed.color === "imperial"
            ? 4
            : 5;
        return {
          ...resolved,
          color: `var(--mantine-color-${parsed.color}-${shade})`,
        };
      }
    }
    return resolved;
  },
  fontFamily: '"Source Sans 3", system-ui, sans-serif',
  fontSizes: {
    xs: "0.875rem",
    sm: "1rem",
    md: "1.0625rem",
    lg: "1.1875rem",
    xl: "1.375rem",
  },
  lineHeights: { xs: "1.5", sm: "1.55", md: "1.6", lg: "1.6", xl: "1.5" },
  headings: {
    fontFamily: '"Cinzel", Georgia, serif',
    fontWeight: "600",
    sizes: {
      h1: { fontSize: "clamp(1.8rem, 3.5vw, 2.75rem)", lineHeight: "1.18" },
      h2: { fontSize: "clamp(1.5rem, 2.8vw, 2rem)", lineHeight: "1.25" },
      h3: { fontSize: "1.375rem", lineHeight: "1.35" },
      h4: { fontSize: "1.1875rem", lineHeight: "1.4" },
      h5: { fontSize: "1.0625rem", lineHeight: "1.4" },
      h6: { fontSize: "1rem", lineHeight: "1.4" },
    },
  },
  breakpoints: {
    xs: "36em",
    sm: "48em",
    md: "62em",
    lg: "75em",
    xl: "88em",
    xxl: "120em",
  },
  colors: {
    red: [
      "#fff0f0",
      "#ffd6d6",
      "#ffaaaa",
      "#ff8080",
      "#ff6060",
      "#ff4545",
      "#e52e2e",
      "#c91d1d",
      "#a51212",
      "#7c0b0b",
    ],
    green: [
      "#eafff0",
      "#c5ffdb",
      "#94f8ba",
      "#61ee97",
      "#38e57d",
      "#20d368",
      "#12b653",
      "#079240",
      "#047132",
      "#035226",
    ],
    dark: [
      "#edf2f7",
      "#d5dfe8",
      "#b6c6d4",
      "#8196a8",
      "#506b81",
      "#293f54",
      "#12273a",
      "#0b1b2c",
      "#071321",
      "#040c16",
    ],
    imperial: [
      "#fff9e8",
      "#fbedc7",
      "#f6dda0",
      "#efcb79",
      "#e8bc58",
      "#d4a343",
      "#b9892e",
      "#906920",
      "#684b16",
      "#49330e",
    ],
    success: [
      "#e8fff3",
      "#c7fce1",
      "#a0f8cc",
      "#6ff3b1",
      "#3eeb91",
      "#20d87a",
      "#11b961",
      "#0b8d48",
      "#076936",
      "#044625",
    ],
    sky: [
      "#effaff",
      "#dff3fe",
      "#bbe8fd",
      "#7dd5fc",
      "#38bdf8",
      "#0ea5e9",
      "#0284c7",
      "#0369a1",
      "#075985",
      "#0c4a6e",
    ],
    blue: [
      "#ebf6ff",
      "#cce7ff",
      "#99d0ff",
      "#66baff",
      "#42aaff",
      "#249dff",
      "#0874dc",
      "#075bb5",
      "#06448c",
      "#053164",
    ],
    purple: [
      "#f5efff",
      "#e8d6ff",
      "#d4b3ff",
      "#bd91ff",
      "#ae7aff",
      "#a16bff",
      "#8b3dff",
      "#7225d9",
      "#5719ae",
      "#3e117f",
    ],
    palePurple: [
      "#f3efff",
      "#e0d9fa",
      "#ccc1ed",
      "#b6a5e3",
      "#a491d5",
      "#8773b8",
      "#7060a0",
      "#594781",
      "#42356a",
      "#30284e",
    ],
    spaceBlue: [
      "#ebf7ff",
      "#d3eaff",
      "#add9fa",
      "#82c7ed",
      "#64b6e0",
      "#399aca",
      "#237cac",
      "#18648d",
      "#124c6e",
      "#0b354f",
    ],
    discordBlue: [
      "#ecf1ff",
      "#d7e0fa",
      "#afbded",
      "#8499e0",
      "#5f79d5",
      "#4866cf",
      "#3b5ccd",
      "#2c4cb6",
      "#2444a4",
      "#173992",
    ],
    magenta: [
      "#fff0fc",
      "#f5d9ef",
      "#eab7e2",
      "#e39bd7",
      "#d37cc5",
      "#bd58ac",
      "#a03e91",
      "#812d75",
      "#64235c",
      "#491a44",
    ],
  },
  components: {
    Title: Title.extend({
      styles: (_theme, { order = 1, size }) => {
        // Visual size determines the font; order describes the document outline.
        const display = ["h1", "h2"].includes(String(size ?? `h${order}`));
        return {
          root: {
            fontFamily: display
              ? "var(--font-display)"
              : "var(--mantine-font-family)",
            letterSpacing: display ? "0.015em" : 0,
          },
        };
      },
    }),
    Button: Button.extend({
      defaultProps: { variant: "filled", size: "md" },
      styles: {
        root: { fontWeight: 600, fontSize: "var(--command-font-control)" },
        label: { whiteSpace: "normal", lineHeight: 1.25 },
      },
    }),
    ActionIcon: ActionIcon.extend({
      defaultProps: { size: "lg", variant: "light" },
    }),
    Input: Input.extend({ defaultProps: { size: "md" } }),
    InputBase: InputBase.extend({ defaultProps: { size: "md" } }),
    // Mantine 9 forwards InputBase's default size to multi-select fields.
    // Preserve the compact fields used by the existing setup forms.
    MultiSelect: MultiSelect.extend({ defaultProps: { size: "sm" } }),
    // Keep the original small steppers with the InputBase-sized field.
    NumberInput: NumberInput.extend({ defaultProps: { size: undefined } }),
    Checkbox: Checkbox.extend({ defaultProps: { size: "md", radius: "xs" } }),
    Radio: Radio.extend({ defaultProps: { size: "md" } }),
    Switch: Switch.extend({ defaultProps: { size: "md" } }),
    Badge: Badge.extend({
      defaultProps: {
        variant: "light",
        color: "gray",
        radius: "xl",
        size: "lg",
      },
      styles: {
        root: { textTransform: "none", letterSpacing: 0, fontWeight: 600 },
      },
    }),
    Alert: Alert.extend({
      defaultProps: { color: "sky", variant: "light", radius: "sm" },
    }),
    Paper: Paper.extend({ defaultProps: { radius: "sm" } }),
    Modal: Modal.extend({
      defaultProps: {
        closeButtonProps: { "aria-label": "Close dialog" },
        centered: true,
        padding: "lg",
        overlayProps: { backgroundOpacity: 0.8, blur: 3 },
      },
    }),
    Drawer: Drawer.extend({
      defaultProps: { closeButtonProps: { "aria-label": "Close panel" } },
    }),
    Tabs: Tabs.extend({
      defaultProps: { variant: "outline", keepMounted: false },
      styles: {
        tab: { minHeight: 44, fontSize: "1rem", whiteSpace: "normal" },
        tabLabel: { lineHeight: 1.4 },
      },
    }),
    SegmentedControl: SegmentedControl.extend({
      defaultProps: { size: "md" },
      styles: {
        label: {
          minHeight: 42,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          whiteSpace: "normal",
        },
      },
    }),
    Accordion: Accordion.extend({
      defaultProps: { variant: "separated" },
      styles: { label: { fontWeight: 600 }, control: { minHeight: 52 } },
    }),
    Tooltip: Tooltip.extend({
      defaultProps: { withArrow: true, multiline: true, maw: 320 },
    }),
  },
});
