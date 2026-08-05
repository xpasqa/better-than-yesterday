# Section & Task drag-and-drop — Todo

UI-only feature, no separate plan.md — this checklist is the implementation plan.

## Dependency
- [ ] Add `@dnd-kit/core` + `@dnd-kit/sortable`

## Data model
- [ ] Remove `order` from `Task` in `types/index.ts`
- [ ] `App.tsx`: `handleAddTask` stops setting `order`
- [ ] Update every `Omit<Task, 'id' | 'createdAt' | 'order'>` signature (AddTaskForm, BoardView) to drop `'order'`
- [ ] `mockData.ts`: remove `order` from the seed tasks

## Shared state (App.tsx)
- [ ] `handleReorderSections(projectId, orderedSectionIds)` — reorders only that project's slots in the `sections` array, other projects' sections keep their array position
- [ ] `handleMoveTask(taskId, beforeTaskId?, sectionId?: string | null)` per the three-state `sectionId` semantics in spec.md (omitted = don't touch, `null` = clear to "No Section", string = set to that section)
- [ ] Thread both handlers down to `MainContent`

## Grip handle
- [ ] Add a shared small grip-handle affordance (`DotsSixVerticalIcon`, reveal-on-hover) to: section headers (List), board column headers (Board), `TaskItem` (List), `TaskCard` (Board)

## Section drag-and-drop
- [ ] Wrap `MainContent`'s active render (List sections or `<BoardView>`) in one `DndContext`
- [ ] List: `SortableContext` over `projectSections` ids, drag reorders via `handleReorderSections`
- [ ] Board: `SortableContext` over the same section ids for the column strip, drag reorders via the same handler
- [ ] "(No Section)" group/column and Board Date-mode columns are not draggable

## Task drag-and-drop
- [ ] Flat views (Today/Upcoming/Filters, zero-section project/Inbox): one sortable container per view, drag reorders via `handleMoveTask(taskId, beforeTaskId)` (no `sectionId`)
- [ ] Section-grouped List: each section's task list + the "(No Section)" list is its own sortable container; cross-container drop calls `handleMoveTask` with the target `sectionId` (or `null` for "No Section")
- [ ] Board Section mode: each column's task list is its own sortable container, same cross-container behavior as List
- [ ] Board Date mode: each date column is a sortable container for within-column reorder only; cross-column drop is rejected (no state change)

## Verify
- [ ] `tsc -b`, `npm run build`, `oxlint` all clean
- [ ] Reorder sections in List; confirm Board reflects the new order, and vice versa
- [ ] Reorder a task within the same section/column, List and Board
- [ ] Drag a task between sections, List and Board; confirm `sectionId` and position are both correct
- [ ] Drag a task in a flat view; confirm it only reorders within that view, no section side effects
- [ ] Board Date mode: within-column reorder works; cross-column drop is rejected
- [ ] Rename/delete/⋯ menu on sections and click-to-open on tasks still work with the new grip handles present
- [ ] Zero-section project's flat list still drag-reorders correctly (no regression from the Kanban feature's flat-rendering fallback)

## Commit
- [ ] Single commit (or a couple of logical ones) once the above is verified
