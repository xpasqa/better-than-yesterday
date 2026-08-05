# Section & Task drag-and-drop — Spec

## Context

Sections (List and Board/Kanban) already exist as a real feature
(`docs/kanban-board/spec.md`). Their order is currently fixed at creation
time — a section can only be appended or inserted via the hover-revealed
"Add section" gap, never reordered after the fact. Tasks have the same
limitation: they render in whatever order they sit in the `tasks` array,
with no way to reorder them by hand.

This spec adds drag-and-drop for both:

- **Sections** — reorder the columns/groups themselves, in both List and
  Board view.
- **Tasks** — reorder within a list, and move between sections/columns,
  in both List and Board view, plus reorder-only in the flat views
  (Today, Upcoming, Filters & Labels, and any project with zero sections).

Both pieces are being built together in this pass (the user's explicit
call, overriding the smaller "sections first" sequencing that was
initially proposed).

## Data model

`Task.order: number` is set on creation (`order: tasks.length + 1`) but
is never read anywhere — `TaskList` renders tasks in whatever order the
filtered array hands it, which is array-insertion order. It's dead
weight that would become actively misleading once drag-and-drop starts
mutating order without touching this field.

**`order` is removed from `Task`.** Array position becomes the single
source of truth for task order, exactly matching how `Section` order
already works (no `order` field on `Section` either — position in the
`sections` array is its order). `handleAddTask` in `App.tsx` stops
setting it; `AddTaskForm`'s `Omit<Task, 'id' | 'createdAt' | 'order'>`
signatures drop the `'order'` exclusion since the field no longer exists.

Because every view (Today, Upcoming, project List, project Board) derives
its task list via `.filter()` on the single `tasks` array, and `.filter()`
preserves relative order, keeping the global `tasks` array correctly
ordered is sufficient for every view to render correctly ordered — no
per-view order bookkeeping needed.

## Library

Add `@dnd-kit/core` and `@dnd-kit/sortable`. Headless (no bundled
styling), which fits this project's existing plain-CSS-per-component
approach — it provides drag sensors, collision detection, and sortable
list/cross-container primitives without imposing any visual design.

## Section drag-and-drop

**Handle:** a grip icon (`DotsSixVerticalIcon` from `@phosphor-icons/react`,
already the app's icon set) appears on hover at the start of a section
header (List: `main-content__section-header`; Board:
`board-column__header`), following the same reveal-on-hover convention as
the existing `⋯` menu. Dragging starts from the grip only — clicking
elsewhere on the header (rename, `⋯` menu, collapse chevron) is
unaffected.

**Scope:** since List and Board are never both mounted at once
(`viewMode` toggle in `MainContent`), one `DndContext` wrapping whichever
is currently rendered is enough — there's no need to synchronize two
simultaneously-active drag surfaces.

**Handler:** `handleReorderSections(projectId: string, orderedSectionIds: string[])`
in `App.tsx`. It walks the existing `sections` array once, and wherever
it finds a section belonging to `projectId`, substitutes in the next id
from `orderedSectionIds` in sequence — every other project's sections
keep their original array slots untouched. This mirrors the existing
`beforeSectionId` insertion logic (`handleAddSection`) in spirit: the
array is the single ordered list across all projects, and a per-project
reorder only touches that project's own slots.

**"(No Section)" bucket / Date-mode columns are not draggable** — neither
is backed by a real `Section`, so there's nothing to reorder them
against.

## Task drag-and-drop

Two flavors, depending on whether the view groups by section:

**Flat views** (Today, Upcoming, Filters & Labels, and any Inbox/project
with zero sections): a single sortable container per view. Dragging
reorders within that filtered list; the new relative order is written
back into the global `tasks` array (insert immediately before/after the
target task's current array index, leaving every other task's relative
order untouched — same pattern as sections).

**Section-grouped views** (Inbox/Project List with sections, Board in
Section-grouping mode): each section/column is its own sortable
container. Dragging within a container reorders; dragging into a
different container updates `sectionId` to the target section.

**Board Date-grouping mode**: each date column (Overdue/Today/Upcoming/No
date) is still a sortable container — a task can be reordered within its
own date column — but dropping a task into a *different* date column is
rejected (drop is a no-op). Changing a task's due date via drag is a
distinct feature and explicitly out of scope here; date columns are
synthetic (derived from `dueDate`, not a real relationship, the way
`sectionId` is), so "moving" a task into one has no well-defined meaning
without also deciding to mutate `dueDate` — a call intentionally not made
in this pass.

**Handler:** `handleMoveTask(taskId: string, beforeTaskId: string | undefined, sectionId?: string | null)`
in `App.tsx`, general enough to cover every case above. The `sectionId`
parameter has three distinct states, which is why it's `string | null`
rather than a plain optional `string` (a plain `options?: { sectionId?: string }`
can't tell "explicitly cleared" apart from "not passed" — both look like
`undefined` at runtime):
- `sectionId` **omitted** (`undefined`) → don't touch `task.sectionId` at
  all. Used for flat-view drags (Today/Upcoming/Filters, zero-section
  projects) where sections aren't part of the model.
- `sectionId` **`null`** → explicitly clear `task.sectionId`, i.e. the
  task was dropped into "No Section" / "No Section" Board column.
- `sectionId` **a section id string** → set `task.sectionId` to it.

Every section-grouped drop (List with sections, Board in Section mode)
always passes one of the last two explicitly — the drop target's
container is always known at drop time, so there's never a case where a
section-grouped view needs to "leave it alone."

`beforeTaskId` behaves the same regardless of `sectionId`: re-insert the
task immediately before that id's current array index, or append to the
end if omitted (covers dropping into an empty section/column, or at the
tail of a list).

**Handle:** same grip-icon convention as sections, added to `TaskItem`
(List) and `TaskCard` (Board), reveal-on-hover.

## Visual feedback

dnd-kit defaults, kept minimal and consistent with the app's existing
plain styling — no new shadow/elevation language invented for this:
- Dragged item: reduced opacity, follows the cursor via `DragOverlay`.
- Other items in the container: shift via `useSortable`'s transform to
  show where the drop would land.
- No extra "drop zone" highlight beyond what dnd-kit's transform-based
  reflow already communicates — the existing section/column background
  (`#fafafa`) and card borders are enough visual grouping.

## Out of scope

- Changing a task's `dueDate` by dragging it into a different Board
  Date-mode column (see above).
- Dragging a section or task across *projects* (Board and section-scoped
  List are always single-project; there's no cross-project drop target to
  define).
- Touch/mobile drag support — this app targets desktop mouse interaction
  throughout, matching everything built so far.
- Keyboard-accessible reordering (dnd-kit supports it, but it's not part
  of this pass; can be added later without touching this design).

## Verify

- `tsc -b`, `npm run build`, `oxlint` all clean.
- Reorder sections in List view; confirm Board reflects the new order
  (and vice versa).
- Reorder a task within the same section/column, in both List and Board.
- Drag a task from one section to another, in both List and Board;
  confirm `sectionId` updates and it lands in the right visual position.
- Drag a task in a flat view (Today/Upcoming/Filters, zero-section
  project); confirm it only reorders within that view.
- In Board Date-mode, drag a task within its own column (works) and
  attempt to drag it into a different date column (rejected, no change).
- Confirm rename/delete/⋯-menu interactions on sections and the
  click-to-open behavior on tasks still work unaffected by the new grip
  handles.
