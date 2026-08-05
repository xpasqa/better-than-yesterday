# Todo — dark mode

## Tokenise
- [x] shadow recipes → 4 tokens
- [x] scrims / brand tint / priority tints → named tokens
- [x] remaining `rgba(0,0,0,α)` → `rgba(var(--overlay-rgb), α)`, alphas kept
- [x] opaque hex → semantic tokens
- [x] `background: #fff` split into `--bg-raised` vs `--bg-primary` by role
- [x] zero literal colours left in `src/components/*.css`, `App.css`,
      `global.css` (one mention survives inside a comment)

## Palette
- [x] new light tokens added at their existing values
- [x] `:root[data-theme="dark"]` override block
- [x] `--bg-tertiary` darker than `--bg-raised` so recessed surfaces stay recessed
- [x] shadow alphas raised for dark
- [x] brand + priority + positive lifted for contrast on `#1c1b1a`
- [x] `filter: brightness()` for data-driven project colours

## Switch
- [x] `useTheme` hook — stored preference wins, otherwise follow the OS
- [x] blocking inline script in `index.html` (verified: line 12, before the
      module tag at line 19 in the built output)
- [x] `ThemeToggle` in the sidebar header and the compact top bar

## Verify
- [x] `npx tsc -b --force`
- [x] `npm run build`
- [x] `npx oxlint src`
- [x] dark: Today, Mail, Board, Storage, Agent, task modal, section dropdown,
      date picker, mobile top bar, sidebar drawer
- [x] light regression: 9 computed colours match their pre-change values
- [x] no white flash on a dark-mode reload
