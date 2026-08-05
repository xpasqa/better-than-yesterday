# Responsive layout — mobile & iPad

## Problem

The app is desktop-only. There is no media query anywhere except one at
1100px in the Agent file panel. Below ~1000px the layout breaks in three
specific ways:

1. The 280px sidebar is a permanent flex child, so it eats a third of an
   iPad-portrait viewport and more than half of a phone viewport.
2. Every full-page view uses `max-width: 800px; margin: 0 auto; padding:
   56px 0 100px` — no horizontal padding. Once the available width drops
   below 800px the content column touches both screen edges.
3. Mail is a hard three-column layout (190px + 340px + rest). At 390px
   the reading pane is negative-width in practice.

## Goals

Make every view usable on a phone and on an iPad, without changing how
anything looks on a desktop. No visual regressions above 1024px.

## Non-goals

- Native gestures (swipe-to-delete, pull-to-refresh).
- A separate mobile codebase or component set. One tree, CSS-driven.
- Touch drag-and-drop tuning beyond what dnd-kit already does. The
  PointerSensor already has `touch-action: none` on drag sources.

## Breakpoints

Two, named after the device class they land on:

| Range | Name | Devices |
|---|---|---|
| `≥ 1024px` | desktop | laptop, iPad landscape |
| `768px–1023px` | tablet | iPad portrait, small windows |
| `≤ 767px` | phone | iPhone, Android |

`1024px` is the line where the sidebar stops being docked. iPad landscape
is exactly 1024 CSS px, so it keeps the full desktop layout — which is the
right call, that's a 1024px-wide screen with room for a sidebar.

Media queries are written per-component, in each component's own `.css`
file, matching the existing convention. There is no central responsive
stylesheet.

## Layout: shell

Today `.app-layout` is a flex row of `[Sidebar, view]`, and every view is
`height: 100vh`.

Below 1024px:

- A **top bar** appears (52px) holding a hamburger and the notification
  bell. It is the only chrome added; it does not duplicate the view's own
  `<h1>`.
- The sidebar becomes an **off-canvas drawer**: `position: fixed`,
  `transform: translateX(-100%)` when closed, over a dimmed backdrop.
  Choosing a view or a project closes it.
- The desktop collapse-to-48px-rail behaviour is suppressed — a drawer is
  either open or shut, a 48px rail inside a drawer makes no sense.

To make room for the top bar, the shell becomes a flex **column**
(`topbar` + `.app-layout`), and every view's `height: 100vh` becomes
`height: 100%`. `html, body, #root` are already `height: 100%`, so this
is a mechanical substitution with no behaviour change on desktop.

## Layout: content column

Every `__inner` (`main-content`, `storage-view`, `outline-view`,
`agent-view`, `agent-chat`) gains a horizontal gutter below 1024px:

- tablet: `padding: 56px 32px 100px`
- phone: `padding: 24px 16px 88px`

Phone drops the top padding because the top bar already provides that
separation, and shrinks the header type (27px → 22px).

## Layout: Mail

The only view whose structure genuinely has to change.

**Tablet** — the folder column collapses to a 60px icon rail. Labels and
counts hide; the compose button keeps its red circle and drops its text.
Still three panes.

**Phone** — `.mail-view` flips to `flex-direction: column` and becomes a
two-level drill-down:

- The folder column becomes a horizontally-scrolling **chip strip** at the
  top, compose first, then the six folders.
- The message list fills the rest.
- Selecting a message (or composing) swaps the list out for the reading
  pane, which gains a **back button** in its toolbar.

This is driven by one class, `mail-view--reading`, applied when a message
is open or a draft is being composed. No extra state — it's derived from
`activeMessage || composing`. The back button clears both.

## Layout: Board

Board keeps horizontal scrolling — that's the correct board behaviour on
a small screen, not a bug. Only its padding shrinks (40px → 20px → 16px)
and columns narrow to 272px on a phone so a second column peeks in and
signals that the board scrolls.

## Layout: task detail modal

- tablet: the overlay gains a 24px horizontal gutter so the 800px card
  doesn't butt against the edges.
- phone: full-screen sheet — no radius, no top offset, and the 260px
  properties sidebar stacks underneath the main pane instead of beside it.

## Touch affordances

Several controls are `opacity: 0` until hover, which on a touch screen
means permanently invisible:

- section `⋯` menu (list + board)
- sub-task delete
- add-task-form label/priority row
- sidebar section `+`

All are revealed unconditionally under `@media (hover: none)`. The
hover-revealed *insert-section gap* is different — it is deliberately
invisible at rest and has no touch equivalent, so it is hidden entirely
on phones and the explicit "Add section" button covers that job.

Interactive rows that were sized for a mouse (nav items, mail folders,
toolbar buttons) go to a 40px minimum under `hover: none`.

## Success criteria

- 390px (iPhone), 768px (iPad portrait), 1024px (iPad landscape) and
  1440px all render without horizontal page scroll.
- Nothing above 1024px changes.
- Every view is reachable and every primary action is tappable on a phone.
