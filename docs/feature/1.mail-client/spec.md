# Mail client — Spec

## Context

Every major view in this app clones a specific real product so the UI
work has a concrete visual target: task views (List/Board) clone
**Todoist**, Storage/Outline/Agent are their own generic patterns. Mail
is a new sidebar view, positioned directly above "Storage", cloning
**Apple Mail**'s classic 3-column layout — folder sidebar, message list,
reading pane.

Like every other view in this app, Mail has no backend: all data is
mock/in-memory, seeded from `mockData.ts`, mutated only via local React
state. Compose/reply/forward never send anything anywhere — they append
to local state, the same way `AddTaskForm` only ever mutates the local
`tasks` array.

Confirmed scope (full v1, not a cut-down MVP — explicit user call, this
is a UI exploration pass):
- Read: folder list, message list for the active folder, reading pane
- Compose, Reply, Forward — local-state only
- Search — filters the message list by subject/sender/body
- Mark read/unread, flag/star a message
- Folders: **Inbox, Sent, Drafts, Junk, Trash, Flagged** (six, matching
  Apple Mail's own sidebar)

Out of scope (no real backend exists in this app, full stop):
real sending/receiving, multiple accounts, IMAP/SMTP, real attachments
(a decorative UI affordance only, same treatment as `AddTaskForm`'s
disabled "Attachment" chip), push notifications.

## Data model

```ts
export type MailFolder = 'inbox' | 'sent' | 'drafts' | 'junk' | 'trash'
// 'flagged' is NOT a folder a message lives in — it's a cross-folder
// filter (any message, in any folder, with isFlagged: true), matching
// how Apple Mail's own "Flagged" sidebar item works: a smart filter,
// not a 6th mutually-exclusive location.

export interface MailMessage {
  id: string
  folder: MailFolder
  sender: string
  senderEmail: string
  subject: string
  body: string
  receivedAt: string        // ISO date, reuse the same format Task.createdAt already uses
  isRead: boolean
  isFlagged: boolean
  inReplyTo?: string        // id of the message this was a reply/forward to, for thread context in the reading pane
}
```

Six sidebar rows total, five of which are real `MailFolder` values
(`Inbox`, `Sent`, `Drafts`, `Junk`, `Trash`) plus `Flagged` as the smart
filter described above.

`mockData.ts` gains `mailMessages: MailMessage[]` — seeded with at least
one message per real folder (five) so no folder renders empty by
default, plus at least one seeded `isFlagged: true` message so the
Flagged filter has something to show immediately.

## Components

Follows the same `XView.tsx` + `XView.css` sibling-view pattern as
`StorageView`/`OutlineView`/`AgentView` — `MailView` is the top-level
component `App.tsx` swaps in for `activeView === 'mail'`, and owns all
Mail state locally (nothing outside Mail reads or mutates it, same
reasoning `OutlineView` already uses for its own local state).

- **`MailView.tsx`** — owns `messages: MailMessage[]` state, active
  folder, active message id, search query, compose state. Lays out the
  3-column shell.
- **`MailSidebar.tsx`** — the six-row folder list (Inbox/Sent/Drafts/
  Junk/Trash/Flagged), each with an unread count badge where relevant
  (Inbox only, matching Apple Mail).
- **`MailList.tsx`** — the message list for whatever's active (a real
  folder, or the Flagged smart filter), filtered further by the search
  query if one is present.
- **`MailListItem.tsx`** — one row: sender, subject, preview snippet,
  received time, unread dot, flag indicator.
- **`MailReadingPane.tsx`** — full message: sender/subject/date header,
  body, Reply/Forward/Flag/Delete actions. Empty state when nothing is
  selected.
- **`MailComposeForm.tsx`** — compose/reply/forward form (To, Subject,
  Body, Send/Cancel), reused for all three entry points by pre-filling
  different fields (reply/forward pre-fill recipient/subject/quoted
  body, plain compose starts blank).

## Types & routing

`ViewType` (in `types/index.ts`) gains `'mail'`. `Sidebar.tsx` gains one
nav entry, positioned directly above the existing "Storage" entry,
following the exact same nav-item pattern (icon + label, active-state
styling) already used for Storage/Outline/Agent. `App.tsx` gains one
more branch in its `activeView` swap, identical in shape to the existing
`storage`/`outline`/`agent` branches.

## Verify

- `tsc -b`, `npm run build`, `oxlint` all clean
- Sidebar: "Mail" appears directly above "Storage", clicking it swaps in
  `MailView`, active-state highlight matches the other nav items
- Every one of the six sidebar rows (5 folders + Flagged) shows its
  correct seeded messages, and Flagged correctly aggregates flagged
  messages across folders rather than being its own bucket
- Click a message → reading pane shows it, unread → read transition
  updates the sidebar's unread count
- Search filters the list live by subject/sender/body
- Flag/unflag a message → Flagged filter list updates immediately
- Compose → new message appears in Drafts or Sent depending on
  Send vs. Save-as-draft (define exact behavior during implementation;
  at minimum, Send must visibly do *something* observable — append to
  Sent — not silently no-op)
- Reply/Forward pre-fill correctly from the source message
- Switching to any other sidebar view and back to Mail preserves
  nothing special — Mail's local state resets are acceptable (matches
  how `OutlineView`'s local state already behaves on remount, no
  precedent in this app for persisting local-only view state across
  navigation)
