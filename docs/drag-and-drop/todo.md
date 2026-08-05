# Section & Task drag-and-drop — Todo

UI-only feature, no separate plan.md — this checklist is the implementation plan.

## Dependency
- [x] Add `@dnd-kit/core` + `@dnd-kit/sortable` (+ `@dnd-kit/utilities` for the transform helper)

## Data model
- [x] Remove `order` from `Task` in `types/index.ts`
- [x] `App.tsx`: `handleAddTask` stops setting `order`
- [x] Update every `Omit<Task, 'id' | 'createdAt' | 'order'>` signature (AddTaskForm, BoardView, MainContent) to drop `'order'`
- [x] `mockData.ts`: remove `order` from the seed tasks

## Shared state (App.tsx)
- [x] `handleReorderSections(projectId, orderedSectionIds)` — reorders only that project's slots in the `sections` array, other projects' sections keep their array position
- [x] `handleMoveTask(taskId, beforeTaskId?, sectionId?: string | null)` per the three-state `sectionId` semantics in spec.md (omitted = don't touch, `null` = clear to "No Section", string = set to that section)
- [x] Thread both handlers down to `MainContent`

## Drag source
- [x] ~~Dedicated grip-handle affordance~~ — superseded: real Todoist drags from anywhere on the row/header, not a small icon. The whole row/header is now the pointer-sensor target (`dragAttributes`/`dragListeners` spread directly onto `TaskItem`'s `<li>`, `TaskCard`'s `<div>`, the section header, and the board column header), relying on dnd-kit's `activationConstraint: { distance: 4 }` to disambiguate a click (checkbox, ⋯ menu, collapse, open-detail) from a real drag. `GripHandle.tsx`/`.css` were deleted as unused.

## Section drag-and-drop
- [x] Wrap `MainContent`'s active render (List sections or `<BoardView>`) in one `DndContext`
- [x] List: `SortableContext` over `projectSections` ids, drag reorders via `handleReorderSections`
- [x] Board: `SortableContext` over the same section ids for the column strip, drag reorders via the same handler
- [x] "(No Section)" group/column and Board Date-mode columns are not draggable

## Task drag-and-drop
- [x] Flat views (Today/Upcoming/Filters, zero-section project/Inbox): one sortable container per view, drag reorders via `handleMoveTask(taskId, beforeTaskId)` (no `sectionId`)
- [x] Section-grouped List: each section's task list + the "(No Section)" list is its own sortable container; cross-container drop calls `handleMoveTask` with the target `sectionId` (or `null` for "No Section")
- [x] Board Section mode: each column's task list is its own sortable container, same cross-container behavior as List
- [x] Board Date mode: each date column is a sortable container for within-column reorder only; cross-column drop is rejected (no state change)

## Visual polish (added after initial pass, per feedback)
- [x] `DragOverlay` in both `MainContent` and `BoardView` — the dragged task/section floats and follows the cursor with an elevated shadow, instead of just reflowing in place
- [x] Red insertion-line indicator (`isOver` from `useSortable`) shown exactly where the item would land: horizontal above a task row/card or a section group, vertical to the left of a Board column
- [x] `user-select: none` + `touch-action: none` on sortable rows/headers so grabbing text doesn't fight the browser's native selection

## Verify
- [x] `tsc -b`, `npm run build`, `oxlint` all clean
- [x] Reorder sections in List; confirm Board reflects the new order, and vice versa
- [x] Reorder a task within the same section/column, List and Board
- [x] Drag a task between sections, List and Board; confirm `sectionId` and position are both correct
- [x] Drag a task in a flat view; confirm it only reorders within that view, no section side effects
- [x] Board Date mode: within-column reorder works; cross-column drop is rejected
- [x] Rename/delete/⋯ menu on sections and click-to-open on tasks still work now that the whole row/header is the drag source
- [x] Zero-section project's flat list still drag-reorders correctly (same `reorder-only` code path already verified via Today's Overdue/Today-list containers)

## Commit
- [x] Single commit (or a couple of logical ones) once the above is verified
