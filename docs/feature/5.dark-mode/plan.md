# Plan — dark mode

Tokenisation first, palette second. Doing it the other way round means
theming against a moving target.

## 1. Tokenise the component stylesheets

A single scripted pass over `src/components/*.css`, in this order (the
order matters — the blanket scrim rule would otherwise eat the shadows):

1. Four repeated shadow recipes → `--shadow-dropdown`, `--shadow-drag`,
   `--shadow-toggle`, `--shadow-card-hover`.
2. Named translucent colours → `--scrim`, `--scrim-soft`,
   `--brand-red-tint`, `--priority-p{1,2,3}-tint`.
3. Everything still matching `rgba(0,0,0,α)` → `rgba(var(--overlay-rgb), α)`,
   alpha preserved verbatim.
4. Opaque hex → semantic tokens.

`#fff` splits by role and can't be done blindly: `color: #fff` is always
`--on-brand`, but `background: #fff` is `--bg-raised` for the ~12 floating
surfaces and `--bg-primary` for the 8 page-level ones. Blanket-replace to
`--bg-raised`, then fix the page roots by selector.

Gate: `grep` for any remaining literal colour must come back empty.

## 2. Extend `:root`

New light-mode tokens, all set to the values the sed pass replaced so the
light theme is provably unchanged: `--overlay-rgb`, `--scrim`,
`--scrim-soft`, `--text-hover`, `--text-danger`, `--strike-color`,
`--control-border`, `--on-brand`, `--brand-red-tint`,
`--brand-red-disabled`, `--avatar-bg`, `--bg-board-column`,
`--bg-input-hover`, `--priority-p*-tint`, and the four shadows.

## 3. Add `:root[data-theme="dark"]`

Full override block. Two things that are easy to get wrong:

- `--bg-tertiary` is a *recessed* surface. On light it's lighter than the
  page but darker than the white modal it sits in; on dark it must be
  **darker** than `--bg-raised`, or the description field and the modal's
  properties pane vanish into the modal.
- Shadows need roughly 4× the alpha to register at all.

Plus the `filter: brightness()` rule for data-driven project colours.

## 4. Switch

- `src/hooks/useTheme.ts` — resolve (stored → OS), write
  `documentElement.dataset.theme`, persist on explicit toggle, and keep
  following the OS until the user has chosen.
- `index.html` — dependency-free blocking script running the same
  resolution before first paint.
- `ThemeToggle.tsx/.css` — sun ⇄ moon, `small` in the sidebar header and
  `large` in the compact top bar.
- Wire through `App.tsx` → `Sidebar`.

## 5. Verify

`tsc` / `build` / `oxlint`, then in the browser: every view in dark, the
dropdown and calendar popovers (elevation is the thing most likely to
collapse), and a light-mode regression pass comparing computed colours
against their known pre-change values.
