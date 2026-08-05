# Mail client — Todo

Checklist mirrors `plan.md`'s phases. Check off as each is verified in
the browser, not just written.

## Phase 1 — Data model & mock data
- [x] `MailFolder`, `MailMessage` types in `types/index.ts`
- [x] `'mail'` added to `ViewType`
- [x] `mailMessages` seed data in `mockData.ts` — every real folder has ≥1 message, ≥1 message is flagged

## Phase 2 — Routing shell
- [x] "Mail" nav entry in `Sidebar.tsx`, positioned above "Storage"
- [x] `App.tsx` renders `<MailView />` for `activeView === 'mail'`
- [x] `MailView.tsx`/`.css` 3-column shell
- [x] Browser: clicking Mail swaps the view, active-state highlight correct, other views unaffected

## Phase 3 — Folder sidebar + message list
- [x] Folder column: Inbox/Sent/Drafts/Junk/Trash/Flagged rows, Inbox unread badge
- [x] Message list + rows: filtered per active folder
- [x] Flagged aggregates `isFlagged` messages across all folders (not its own bucket)
- [x] Browser: every folder shows correct seeded messages

## Phase 4 — Reading pane + read/unread + flag
- [x] Reading pane renders selected message, empty state when none selected
- [x] Clicking a message marks it read, sidebar unread count updates (verified 2 → 1)
- [x] Flag toggle in reading pane toolbar, Flagged filter reflects it

## Phase 5 — Search
- [x] Search input filters active folder's messages by subject/sender/body
- [x] Clearing search restores full list

## Phase 6 — Compose, Reply, Forward
- [x] `MailComposeForm.tsx`/`.css`
- [x] Compose entry point → blank compose form
- [x] Reply/Forward entry points in reading pane → pre-filled form
- [x] Send appends to `mailMessages` with `folder: 'sent'`, switches to Sent and opens it
- [x] Cancel discards without mutating state

## Phase 7 — Verify
- [x] `tsc -b --force`, `npm run build`, `oxlint` all clean
- [x] Browser walkthrough: folders, open message, read/unread, flag, search, compose+send
- [x] No regression to other sidebar views or `App.tsx` state

## Design revisions during implementation
- [x] Structure follows Apple Mail (observed directly on the user's Mac);
      styling follows this app's existing tokens/patterns, not macOS chrome
- [x] Dropped the heavy filled "New Message" block button — compose is now a
      quiet icon in the list header (user feedback: "buat lebih minimal dan lebih clean")

## Commit
- [ ] Committed once Phase 7 passes
