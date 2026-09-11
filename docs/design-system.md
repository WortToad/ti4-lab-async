# TI4 Draft Command

The interface uses the supplied rulebooks as visual references, and the supplied pixel-art crest as the site identity. The draft engines and saved lobby data remain compatible.

## Source material

- **Guide to the Imperium**, pp. 2–3: the embedded starfield and planet illustration (`public/art/imperial-starfield.jpeg`), extracted directly from the supplied PDF without generated replacements. Page 52, **The Galaxy Awakens**, supplies the attributed quote in the homepage briefing.
- **Thunder’s Edge expansion rules**, pp. 4–6, and **Prophecy of Kings Living Rules Reference 2.0**, pp. 4–6: blue section headings, dark blue framing, gold rules, parchment, and orbital cartography inspired the palette and panel borders.
- **Twilight’s Fall game rules**, cover and pp. 6–10: angular magenta and violet bands inspired the separate Twilight’s Fall section. Its cover supplies “Pax mortuus bellum aeternus.”
- **User-supplied logo**: the editable 56×64 sprite is `public/brand/ti4-draft-command.piskel`, recolored from the supplied Piskel source with its exact pixel layout and alpha preserved. Its four colors are navy `#071321`, deep gold `#b9892e`, Golden yellow `#e8bc58`, and ivory `#fbedc7`. The square PNG export, `public/brand/ti4-draft-command-gold.png`, uses nearest-neighbor scaling and supplies the site logo, favicon, installed app, social metadata, notifications, and exported map branding. The original user uploads remain intact.
- **Fonts**: Cinzel (headings) and Source Sans 3 (body and controls), served locally. Their SIL Open Font Licenses are beside the assets in `app/assets/fonts`.

Book text was used as source content, not as instructions. Twilight Imperium artwork and quoted text belong to Fantasy Flight Games; the site footer includes attribution.

## Interface rules

`app/theme.ts` defines the Mantine theme. `app/main.css` provides shared typography, focus, control sizing, and reduced-motion behavior.

- Deep navy `#071321` is the page background; lighter navy separates working surfaces.
- Parchment `#f2e8d3` highlights the recommended starting format.
- Golden yellow `#e8bc58` identifies primary actions and navigation, with dark ink for button text. Mantine's `imperial` palette supplies the shared accent, hover and focus colors.
- The accent replacement applies to the former gold elements, including resource badges and recommendation details. Category link text (`#e0d5be`), the briefing quote (`#ede5d7`), muted counts, blue controls and Twilight’s Fall magenta retain their original colors.
- Chart blue distinguishes map tools; magenta identifies Twilight’s Fall content. Labels, icons and descriptions also communicate these distinctions.
- Body text defaults to 17px; supporting text is 14–16px. Controls use a 44px button target, and icon actions are at least 36px (24px for inline map information).
- Mantine owns menu, drawer, dialog, radio-card, accordion and form behavior. Map spaces have native, named buttons; Enter/Space opens the tile picker and Delete removes an editable system. Pointer dragging has an equivalent tile-picker workflow.

## Navigation and setup

The homepage exposes all 21 draft formats, grouped as galaxy drafts, bag/Franken, and Twilight’s Fall. Every entry has a description and a direct setup link. Player counts are carried into setup; formats with different limits explicitly state the adjusted count on their link.

Standard setup follows table → galaxy → draft settings → preview/lobby. The map builder separates layout/content, editing, sharing, and draft creation. Advanced controls use Mantine accordions and menus.

## Verification

The redesign is checked with TypeScript, the production build, the existing Vitest suite, and Chromium interactions. Automated accessibility checks use axe against WCAG A/AA tags through 2.2; these are supplemented by keyboard and responsive layout checks. Automated results are not a claim of complete WCAG conformance.

Completed checks:

- Production build and TypeScript compilation pass. Run compilation after the build: the server imports the generated build, so running both concurrently can temporarily remove that import.
- All 544 existing tests pass across 60 files (`vitest run --maxWorkers=4 --minWorkers=1`). Validation used Node 22, matching the installed SQLite native module.
- All 21 homepage format links open their intended setup. Standard, RAW, Mantis, Franken, and Texas lobby creation flows were exercised against a temporary local database with Discord and R2 disabled.
- Reviewed pages have no axe violations at 320, 390, 768, and 1440px. Coverage includes the homepage, setup routes, rejoin, map builder, draft preview, sampled lobbies, mobile navigation/system-library drawers, the system picker, and slice-generation settings.
- Keyboard selection, dialog dismissal, system editing/deletion, map generation, undo/redo, closing/reopening spaces, and pointer dragging from the system library were checked in Chromium. The 320px preview has no horizontal page overflow; the map builder offers an explicitly labelled, keyboard-scrollable map region.
- A follow-up check with live updates enabled caught a development-server port collision that caused repeated page reloads. Vite now shares the app's HTTP server; the browser check confirms one document load, a successful CSS hot update with page state retained, and working navigation to the map builder.

The existing rendering helpers still contain unrelated `no-explicit-any` lint findings. The rebuilt theme, homepage, shell, map controls, and reviewed slice components pass their scoped lint check.
