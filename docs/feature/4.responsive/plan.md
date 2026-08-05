# Plan — responsive layout

Ordered so the app stays runnable after every step.

## 1. Shell primitives

- `src/hooks/useMediaQuery.ts` — new. Subscribes to a `MediaQueryList`,
  returns a boolean. Used only where CSS cannot reach: deciding whether
  the sidebar is a docked column or a drawer.
- `src/styles/global.css` — `-webkit-text-size-adjust: 100%` so iOS
  Safari does not inflate type in landscape.

## 2. Shell restructure

- `src/App.tsx`
  - `isCompact = useMediaQuery('(max-width: 1023px)')`
  - `drawerOpen` state, closed by default; closes on any view/project
    change and on backdrop click.
  - Wrap in `.app-shell` (flex column), render `.app-topbar` when
    compact, then the existing `.app-layout`.
  - Pass `drawer={isCompact}` to `Sidebar`; force `collapsed={false}`
    when compact.
- `src/App.css` — `.app-shell`, `.app-topbar`, `.app-topbar__menu`,
  `.app-backdrop`; `.app-layout` height `100vh` → `100%` + `min-height: 0`.

## 3. Sidebar drawer

- `src/components/Sidebar.tsx` — new `drawer?: boolean` prop. When set,
  skip the collapsed-rail early return and swap the collapse icon for an
  X. Root gets `sidebar--drawer` / `sidebar--drawer-open`.
- `src/components/Sidebar.css` — fixed positioning, transform, shadow,
  `z-index: 60`; 40px touch rows under `hover: none`; always-visible
  section `+`.

## 4. Content-column gutters

Same media-query block appended to each of:
`MainContent.css`, `StorageView.css`, `OutlineView.css`, `AgentView.css`,
`AgentChat.css`. Plus `height: 100vh` → `100%` in every view root.

## 5. Mail

- `src/components/MailView.tsx` — root className gains
  `mail-view--reading` when `activeMessage || composing`; a back button
  is rendered first in the reading toolbar and a second one inside the
  compose pane header is not needed (Cancel already returns).
- `src/components/MailView.css` — tablet icon rail, phone column flip +
  chip strip + drill-down.

## 6. Remaining views

- `BoardView.css` / `MainContent.css` — board padding + column width.
- `TaskDetailModal.css` — tablet gutter, phone full-screen sheet,
  stacked properties pane.
- `AgentFilePanel.css` — full-width overlay on a phone.
- `TaskItem.css`, `AddTaskForm.css`, `TaskDetailModal.css`,
  `MainContent.css`, `BoardView.css` — `@media (hover: none)` reveals.

## 7. Verify

`npx tsc -b --force` → `npm run build` → `npx oxlint src`, then the
browser at 390 / 768 / 1024 / 1440 px, checking each view and confirming
`document.documentElement.scrollWidth === clientWidth` at every width.
