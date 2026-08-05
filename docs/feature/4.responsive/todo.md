# Todo — responsive layout

## Shell
- [x] `useMediaQuery` hook
- [x] `-webkit-text-size-adjust` in global.css
- [x] `.app-shell` + `.app-topbar` + backdrop in App.tsx / App.css
- [x] every view root `height: 100vh` → `100%`

## Sidebar
- [x] `drawer` prop + X close button
- [x] fixed/transform drawer styles + shadow
- [x] closes on view / project change
- [x] 40px rows and always-visible `+` under `hover: none`

## Content column
- [x] MainContent gutters
- [x] StorageView gutters
- [x] OutlineView gutters
- [x] AgentView gutters
- [x] AgentChat gutters
- [x] header type scales down on phone

## Mail
- [x] tablet: 60px icon rail
- [x] phone: column flip + folder chip strip
- [x] phone: list ↔ reading drill-down via `mail-view--reading`
- [x] back button in reading toolbar

## Other views
- [x] Board padding + 272px columns on phone
- [x] TaskDetailModal tablet gutter
- [x] TaskDetailModal phone full-screen sheet + stacked properties
- [x] AgentFilePanel full-width on phone

## Touch
- [x] section `⋯` menus always visible
- [x] sub-task delete always visible
- [x] AddTaskForm needed no change — its toolbar already `flex-wrap`s and its
      only `opacity: 0` is the hidden native date input, not a hover reveal
- [x] insert-section gap hidden on phone

## Verify
- [x] `npx tsc -b --force`
- [x] `npm run build`
- [x] `npx oxlint src`
- [x] no horizontal scroll at 390 / 768 / 1024 / 1440
      (`documentElement.scrollWidth === clientWidth` on every view at 390)
- [x] desktop unchanged — 1440 and 1024 both render the original three-pane
      Mail, docked sidebar, no top bar
