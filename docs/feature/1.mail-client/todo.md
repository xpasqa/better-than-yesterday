# Mail client — Todo

Checklist mirrors `plan.md`'s phases. Check off as each is verified in
the browser, not just written.

## Phase 1 — Data model & mock data
- [ ] `MailFolder`, `MailMessage` types in `types/index.ts`
- [ ] `'mail'` added to `ViewType`
- [ ] `mailMessages` seed data in `mockData.ts` — every real folder has ≥1 message, ≥1 message is flagged

## Phase 2 — Routing shell
- [ ] "Mail" nav entry in `Sidebar.tsx`, positioned above "Storage"
- [ ] `App.tsx` renders `<MailView />` for `activeView === 'mail'`
- [ ] `MailView.tsx`/`.css` stub shell (3 empty columns)
- [ ] Browser: clicking Mail swaps the view, active-state highlight correct, other views unaffected

## Phase 3 — Folder sidebar + message list
- [ ] `MailSidebar.tsx`/`.css`: Inbox/Sent/Drafts/Junk/Trash/Flagged rows, Inbox unread badge
- [ ] `MailList.tsx`/`.css` + `MailListItem.tsx`/`.css`: filtered list per active folder
- [ ] Flagged aggregates `isFlagged` messages across all folders (not its own bucket)
- [ ] Browser: every folder shows correct seeded messages

## Phase 4 — Reading pane + read/unread + flag
- [ ] `MailReadingPane.tsx`/`.css`: renders selected message, empty state when none selected
- [ ] Clicking a message marks it read, sidebar unread count updates
- [ ] Flag toggle on list item and in reading pane, Flagged filter updates live

## Phase 5 — Search
- [ ] Search input filters active folder's messages by subject/sender/body
- [ ] Clearing search restores full list

## Phase 6 — Compose, Reply, Forward
- [ ] `MailComposeForm.tsx`/`.css`
- [ ] "New Message" entry point → blank compose form
- [ ] Reply/Forward entry points in reading pane → pre-filled form
- [ ] Send appends to `mailMessages` with `folder: 'sent'`, visible immediately
- [ ] Cancel discards without mutating state

## Phase 7 — Verify
- [ ] `tsc -b --force`, `npm run build`, `oxlint` all clean
- [ ] Full browser walkthrough per spec.md's Verify section
- [ ] No regression to other sidebar views or `App.tsx` state

## Commit
- [ ] Committed once Phase 7 passes
