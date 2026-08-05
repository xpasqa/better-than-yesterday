# Kanban (Board) view + Sections — Todo

UI-only feature, no separate plan.md — this checklist is the implementation plan.

## Data model
- [x] Redefine `Section` in `types/index.ts`: `{ id, name, projectId }` (drop the unused embedded `tasks` field)
- [x] Add `sectionId?: string` to `Task`

## Mock data
- [x] Add `sections: Section[]` to `mockData.ts` — a few sections for at least one or two projects
- [x] Assign `sectionId` to a handful of existing mock tasks so the grouping has something to show

## Shared state (App.tsx)
- [x] Lift `sections` state alongside `tasks`
- [x] `handleAddSection(projectId, name)` — also supports an optional `beforeSectionId` to insert between two existing sections (Board's gap-hover affordance)
- [x] `handleRenameSection(id, name)`
- [x] `handleDeleteSection(id)` — un-sets `sectionId` on that section's tasks, doesn't delete them
- [x] Thread `sections` + handlers down to `MainContent`

## AddTaskForm
- [x] Add optional `defaultSectionId` prop, include it when calling `onAdd`

## MainContent — List/Board toggle
- [x] Local `viewMode: 'list' | 'board'` state
- [x] Render the List|Board pill toggle in the header, only for `activeView === 'inbox' || 'project'`

## MainContent — List view sections
- [x] For Inbox/project views, when the project has ≥1 section: group tasks by section instead of the current flat render
- [x] "(No Section)" group first (only if unsectioned tasks exist), then each section in order (even if empty)
- [x] Section header: name, count, `⋯` (Rename/Delete), collapse chevron
- [x] "+ Add task" per section (passes `defaultSectionId`)
- [x] "+ Add section" inline reveal-input at the bottom of the section list
- [x] Projects with zero sections keep today's flat rendering (no regression)

## TaskCard
- [x] `TaskCard.tsx` + `.css`: checkbox, title, description preview, due date badge
- [x] Click opens `TaskDetailModal` via the existing `onOpenTask`

## BoardView
- [x] `BoardView.tsx` + `.css`
- [x] Section/Date grouping toggle (local state)
- [x] Section mode: column per section (+ "No Section" if needed), empty sections still render
- [x] Date mode: fixed Overdue / Today / Upcoming / No date columns, reusing MainContent's existing date-bucket logic
- [x] Column header: name + count (+ `⋯` Rename/Delete in Section mode only)
- [x] Horizontal scroll when columns overflow
- [x] "+ Add task" per column uses the same rich chip form as List view (`AddTaskForm`), not a bare text input — matches real Todoist's Board add-task, and `AddTaskForm`'s toolbar now wraps onto multiple lines to fit a narrow column
- [x] Hover-revealed gap between adjacent columns (Section mode only) to insert a new section at that exact position, not just append at the end
- [x] Board view uses the full page width (not the 800px List/editor column) so columns have room to lay out
- [x] Wire into MainContent when `viewMode === 'board'`

## Verify
- [x] `tsc -b`, `npm run build`, `oxlint` all clean
- [x] Browser: add a section, add a task into it, confirm it shows under that section in List view
- [x] Rename and delete a section from List view; confirm deleted section's tasks land in "(No Section)"
- [x] Switch to Board, confirm columns match List's sections
- [x] Toggle Board to Date grouping, confirm Overdue/Today/Upcoming/No date buckets are correct
- [x] Rename/delete a section from a Board column header, confirm it stays in sync with List
- [x] Click a TaskCard, confirm TaskDetailModal opens with the right task
- [x] Confirm Today/Upcoming/Filters are unaffected (no toggle, no section grouping)
- [x] Confirm a project with zero sections still renders its flat list unchanged
- [x] Insert a section via the Board gap-hover affordance between two existing columns; confirm List view reflects the same order

## Commit
- [ ] Single commit (or a couple of logical ones) once the above is verified
