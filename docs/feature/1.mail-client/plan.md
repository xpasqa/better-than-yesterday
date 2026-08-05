# Mail client — Implementation Plan

Builds on `docs/feature/1.mail-client/spec.md`. Implemented bottom-up:
data model first, then the static shell, then interactivity, so each
phase is independently checkable in the browser before moving on.

## Phase 1 — Data model & mock data

- Add `MailFolder` and `MailMessage` to `src/types/index.ts` (spec's
  data model section, verbatim)
- Add `'mail'` to `ViewType`
- Add `mailMessages: MailMessage[]` to `src/data/mockData.ts` — at least
  one seeded message in each of Inbox/Sent/Drafts/Junk/Trash, plus at
  least one `isFlagged: true` message so Flagged isn't empty on first
  load. Reuse existing mock data conventions (ISO date strings via the
  same `today`/`yesterday` helpers already in the file).

**Check:** `tsc -b` clean, no UI yet.

## Phase 2 — Routing shell (no interactivity)

- `Sidebar.tsx`: add the "Mail" nav entry directly above "Storage",
  same icon+label+active-state pattern as the Storage/Outline/Agent
  entries. Pick a Phosphor icon (`EnvelopeSimpleIcon` or similar).
- `App.tsx`: add the `activeView === 'mail'` branch rendering a stub
  `<MailView />`, identical shape to the existing `storage`/`outline`/
  `agent` branches.
- `MailView.tsx` + `.css`: minimal shell — three empty columns
  (sidebar/list/reading-pane placeholders) just to prove routing works.

**Check:** clicking "Mail" in the sidebar swaps in the stub, active-state
highlight matches other nav items, browser round-trip confirms no
regression to the other views' navigation.

## Phase 3 — Folder sidebar + message list (read-only)

- `MailSidebar.tsx` + `.css`: the six rows (Inbox/Sent/Drafts/Junk/
  Trash/Flagged). Inbox shows an unread-count badge (matching the
  existing count-badge visual pattern already used in the app's own
  Sidebar for projects). `MailView` holds `activeFolder` state
  (`MailFolder | 'flagged'`).
- `MailList.tsx` + `.css` and `MailListItem.tsx` + `.css`: render the
  messages for the active folder (or, for `'flagged'`, every message
  across all folders with `isFlagged: true`). No search yet, no reading
  pane yet — just prove the folder → filtered list wiring is correct.

**Check:** switching folders in the sidebar shows the right seeded
messages per folder; Flagged aggregates across folders correctly.

## Phase 4 — Reading pane + read/unread + flag

- `MailReadingPane.tsx` + `.css`: shows the selected message (empty
  state when nothing's selected). Clicking a `MailListItem` sets
  `activeMessageId` in `MailView` and marks that message `isRead: true`
  (mirrors `handleToggleComplete`'s update-in-place pattern already used
  for tasks).
- Flag toggle: a flag icon on both `MailListItem` (quick-toggle without
  opening the message) and in the reading pane header. Toggling updates
  `isFlagged` and must immediately reflect in the Flagged smart filter
  if that's the active folder.

**Check:** click a message → reading pane renders it, sidebar unread
count decrements; flag/unflag updates the Flagged list live.

## Phase 5 — Search

- Search input above the message list (in `MailList` or a small
  `MailSearchBar` if that reads cleaner once the layout is built).
  Filters the active folder's messages by subject/sender/body,
  case-insensitive substring match — same complexity level as
  `StorageView`'s existing filename filtering, no fuzzy search.

**Check:** typing narrows the list live; clearing restores the full
folder list.

## Phase 6 — Compose, Reply, Forward

- `MailComposeForm.tsx` + `.css`: To/Subject/Body fields + Send/Cancel,
  styled consistent with `AddTaskForm`'s existing card-with-chips
  pattern where it makes sense (this is a simpler form — full chip
  toolbar isn't needed, but border-radius/spacing/button styling should
  reuse the same tokens).
- Compose entry point: a "New Message" button in `MailSidebar` (or
  `MailView`'s header) opens a blank compose form.
- Reply/Forward entry points: buttons in `MailReadingPane`, pre-fill
  recipient/subject (`Re:`/`Fwd:` prefix)/quoted body from the source
  message, set `inReplyTo`.
- Send behavior: append the new message to `mailMessages` with
  `folder: 'sent'`. (Save-as-draft is not required for v1 unless it
  falls out naturally — Send is the one path that must work end-to-end.)

**Check:** New Message → fill form → Send → message appears in Sent;
Reply pre-fills correctly from an open message; Forward pre-fills
correctly; Cancel discards without mutating state.

## Phase 7 — Full verification pass

- `npx tsc -b --force`, `npm run build`, `npx oxlint src` all clean
- Full browser walkthrough per `spec.md`'s Verify section
- Confirm no regression to any other sidebar view or to `App.tsx`'s
  existing state/props

## Commit

One commit once Phase 7 passes (or a couple of logical commits if the
phases end up spanning a very large diff — follow whatever the repo's
existing commit granularity has been for prior features).
