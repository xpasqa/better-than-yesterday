# Kanban (Board) view + Sections — Todo

UI-only feature, no separate plan.md — this checklist is the implementation plan.

## Data model
- [ ] Redefine `Section` in `types/index.ts`: `{ id, name, projectId }` (drop the unused embedded `tasks` field)
- [ ] Add `sectionId?: string` to `Task`

## Mock data
- [ ] Add `sections: Section[]` to `mockData.ts` — a few sections for at least one or two projects
- [ ] Assign `sectionId` to a handful of existing mock tasks so the grouping has something to show

## Shared state (App.tsx)
- [ ] Lift `sections` state alongside `tasks`
- [ ] `handleAddSection(projectId, name)`
- [ ] `handleRenameSection(id, name)`
- [ ] `handleDeleteSection(id)` — un-sets `sectionId` on that section's tasks, doesn't delete them
- [ ] Thread `sections` + handlers down to `MainContent`

## AddTaskForm
- [ ] Add optional `defaultSectionId` prop, include it when calling `onAdd`

## MainContent — List/Board toggle
- [ ] Local `viewMode: 'list' | 'board'` state
- [ ] Render the List|Board pill toggle in the header, only for `activeView === 'inbox' || 'project'`

## MainContent — List view sections
- [ ] For Inbox/project views, when the project has ≥1 section: group tasks by section instead of the current flat render
- [ ] "(No Section)" group first (only if unsectioned tasks exist), then each section in order (even if empty)
- [ ] Section header: name, count, `⋯` (Rename/Delete), collapse chevron
- [ ] "+ Add task" per section (passes `defaultSectionId`)
- [ ] "+ Add section" inline reveal-input at the bottom of the section list
- [ ] Projects with zero sections keep today's flat rendering (no regression)

## TaskCard
- [ ] `TaskCard.tsx` + `.css`: checkbox, title, description preview, due date badge
- [ ] Click opens `TaskDetailModal` via the existing `onOpenTask`

## BoardView
- [ ] `BoardView.tsx` + `.css`
- [ ] Section/Date grouping toggle (local state)
- [ ] Section mode: column per section (+ "No Section" if needed), empty sections still render
- [ ] Date mode: fixed Overdue / Today / Upcoming / No date columns, reusing MainContent's existing date-bucket logic
- [ ] Column header: name + count (+ `⋯` Rename/Delete in Section mode only)
- [ ] Horizontal scroll when columns overflow
- [ ] Simple inline "+ Add task" per column (name only, not the full AddTaskForm)
- [ ] Wire into MainContent when `viewMode === 'board'`

## Verify
- [ ] `tsc -b`, `npm run build`, `oxlint` all clean
- [ ] Browser: add a section, add a task into it, confirm it shows under that section in List view
- [ ] Rename and delete a section from List view; confirm deleted section's tasks land in "(No Section)"
- [ ] Switch to Board, confirm columns match List's sections
- [ ] Toggle Board to Date grouping, confirm Overdue/Today/Upcoming/No date buckets are correct
- [ ] Rename/delete a section from a Board column header, confirm it stays in sync with List
- [ ] Click a TaskCard, confirm TaskDetailModal opens with the right task
- [ ] Confirm Today/Upcoming/Filters are unaffected (no toggle, no section grouping)
- [ ] Confirm a project with zero sections still renders its flat list unchanged

## Commit
- [ ] Single commit (or a couple of logical ones) once the above is verified
