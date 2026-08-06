# Todo — Agent file panel

## Phase 1 — Dependencies, types, and mock content
- [x] Install `react-markdown` + `remark-gfm`
- [x] Create `src/agent/mockFiles.ts` (5 mock files + `FILE_CREATION_SCHEDULE`)
- [x] Extend `ChatMessage` in `AgentView.tsx` to discriminated union with `kind: 'file'`

## Phase 2 — `AgentFileTree`
- [x] Create `src/components/AgentFileTree.tsx` (recursive tree from flat path list)
- [x] Create `src/components/AgentFileTree.css`

## Phase 3 — `AgentFileViewer`
- [x] Create `src/components/AgentFileViewer.tsx` (Preview/Code toggle, Copy, Download)
- [x] Create `src/components/AgentFileViewer.css`

## Phase 4 — `AgentFilePanel` shell
- [x] Create `src/components/AgentFilePanel.tsx` (header + tree region + divider + viewer region)
- [x] Create `src/components/AgentFilePanel.css`

## Phase 5 — Wire into `AgentChat`
- [x] Convert `AgentChat` to row layout (`agent-chat-row`: thread+composer | panel)
- [x] Render `kind: 'file'` messages as clickable file cards in the thread
- [x] Render `AgentFilePanel` inside the row when `panelOpen`
- [x] Backdrop overlay on mobile/tablet that closes panel on tap

## Phase 6 — Wire state and creation script into `AgentView`
- [x] Add `files`, `selectedPath`, `panelOpen`, `unseenPaths`, `replyCount` state
- [x] `sendText` consults `FILE_CREATION_SCHEDULE`, pushes file to state, opens panel on first file
- [x] `selectFile` clears unseen dot for clicked path
- [x] "New task" (`onBack`) resets all state

## Phase 7 — Responsive overlay below 1100px
- [x] `AgentFilePanel` becomes fixed overlay at ≤1100px (z-index 70, shadow)
- [x] Full-width at ≤767px
- [x] Backdrop shown at ≤1100px via CSS media query

## Phase 8 — Full verification pass
- [x] `npx tsc --noEmit` — clean
- [x] `npx oxlint -c ../../oxlint.json .` — clean
- [ ] Browser round-trip: send 7 messages, verify file creation schedule, panel, tree, viewer
- [ ] Verify Copy (clipboard) and Download (.md file) functional
- [ ] Verify "New task" resets everything
- [ ] Verify no regressions on other views
