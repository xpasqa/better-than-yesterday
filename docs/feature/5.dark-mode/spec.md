# Dark mode

## Problem

`variables.css` looks like a themeable design system, but it isn't one yet.
159 colours are hardcoded directly in the 17 component stylesheets, and the
largest group is the one that breaks dark mode most quietly:

```css
background: rgba(0,0,0,0.05);   /* every hover / press tint in the app */
```

A black scrim over a black surface is invisible. Flipping the palette without
fixing these would leave the app *looking* dark but feeling dead — no hover
feedback anywhere.

So this feature is two things, in order:

1. Finish the tokenisation the codebase already started.
2. Add the dark palette and the switch.

## Tokenising

Three techniques, chosen per category:

**Channel tokens for scrims.** Hover tints use eight different alphas
(0.018 … 0.08) that were each tuned by eye. Collapsing them into three
generic tokens would change the light theme. Instead only the *base colour*
becomes a token and every alpha survives untouched:

```css
--overlay-rgb: 0, 0, 0;                   /* dark theme: 255, 255, 255 */
background: rgba(var(--overlay-rgb), 0.05);
```

**Named tokens for shadows.** Four shadow recipes are copy-pasted across
files (`--shadow-dropdown`, `--shadow-drag`, `--shadow-toggle`,
`--shadow-card-hover`). They become tokens both to de-duplicate and because
dark mode needs them far deeper — a 12%-black shadow does nothing over
`#1c1b1a`.

**Semantic tokens for the rest.** `#202020` → `--text-primary`,
`#d3d3d3` → `--control-border`, `#fff` → `--on-brand` or `--bg-raised`
depending on whether it's ink-on-red or a lifted surface, and so on.

That last distinction matters: `--bg-primary` and `--bg-raised` are both
`#fff` in light mode, so they look interchangeable today. In dark mode they
must differ — a dropdown has to read as floating above the page.

## Palette

The light theme is deliberately warm (`#fcfaf8` sidebar, `#ffefe5`
selection). The dark theme keeps that bias rather than going blue-grey:
surfaces run `#171615` (sidebar) → `#1c1b1a` (page) → `#262322` (raised),
and the selected-row peach becomes a deep warm brown `#3d2a20`.

Brand red is lifted from `#d33322` to `#e8604c`. At the original value the
contrast against `#1c1b1a` is about 4:1 — under the bar for the small
14px labels it's used on. The same lift applies to the priority colours and
to `--color-positive`.

Elevation on dark comes from surface lightness plus a visible border, with
shadow as reinforcement — not from shadow alone.

### Project colours

Project/label colours (`#058527`, `#692ec2`, …) come from data, not CSS, so
a token can't reach them. Rather than rewrite the data model, the small `#`
glyphs get `filter: brightness(1.4)` in dark mode. Contained, reversible,
and it only affects the glyph.

## The switch

- State lives on `document.documentElement[data-theme]`, so CSS needs one
  extra selector: `:root[data-theme="dark"]`.
- Default is the OS preference; an explicit choice is stored in
  `localStorage` and wins from then on.
- A blocking inline script in `index.html` sets the attribute before first
  paint. Without it every dark-mode load flashes white while React boots.
- One `ThemeToggle` button (sun ⇄ moon), placed next to the bell in both the
  desktop sidebar header and the compact top bar.

Two states, not three. A light/dark/system cycle needs a label to be
understandable, and a third state buys little once the default already
follows the OS.

## Success criteria

- No hardcoded colour left in `src/components/*.css`.
- Light theme renders pixel-identical to before.
- Every hover, focus and selected state is visible in dark mode.
- No white flash on load with dark mode active.
