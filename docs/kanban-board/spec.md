# Kanban (Board) view + Sections — Spec

## Context

Add a Board (Kanban) layout for tasks, matching Todoist's real Board view.
Reference screenshots (shared by the user, from the real Todoist app)
established the key facts this spec is built on:

- Board view is **section-based**: columns are Sections, and Sections
  always belong to a single project (Inbox included — it defaults to a
  "(No Section)" bucket when none exist).
- Because sections are project-scoped, Board only makes sense on views
  that show a single project's tasks: **Inbox and individual projects**.
  Today/Upcoming/Filters mix tasks from multiple projects with unrelated
  section names, so they stay List-only.
- Before Board can exist, **Sections need to exist as a real feature** —
  create/rename/delete, and List view needs to render them as groups.
- Board should support grouping by **Section** (default) or by **Date**
  (Overdue / Today / Upcoming / No date), toggled inside the Board view.

This spec covers both pieces (Sections in List view, and the new Board
view) since Board has no meaning without Sections existing first.

## Data model

```ts
export interface Section {
  id: string
  name: string
  projectId: string // sections always belong to one project (Inbox included)
}
```

`Task` gains one new optional field:

```ts
sectionId?: string // undefined = the project's "(No Section)" bucket
```

The `Section` interface already declared in `types/index.ts` embedded
`tasks: Task[]` directly on the section — unused anywhere in the codebase,
and inconsistent with how the rest of the app models relationships (`Task`
references `projectId`, nothing embeds a task array). Redefined to match:
sections are looked up by `projectId`, tasks are looked up by `sectionId`,
same pattern as the existing project relationship.

`sections: Section[]` lives in `App.tsx` alongside `tasks` (real shared
app data, mutated from both List and Board views) — not local component
state like `OutlineView`'s nodes, since those views are fully
self-contained and nothing else in the app reads their data.

## Scope

**In scope:** Inbox and individual project views (List and Board).
**Out of scope:** Today, Upcoming, Filters & Labels — List view only,
unchanged, no sections rendered there (a task can still carry a
`sectionId` from its home project, but these aggregate views don't group
by it).

Also explicitly out of scope for this pass:
- Drag-and-drop between Board columns (cards are read/click only; moving
  a task to a different section happens through the section's own
  "+ Add task", not by moving an existing card)
- The project-level "..." menu (Edit / Add to favorites / Move /
  Duplicate) shown in the reference — only "Add section" from that menu
  is relevant here, built as its own inline affordance instead
  - Section description field (the reference's "Add section" form has a
  description textarea mirroring "Add project"'s form; nothing in this
  app reads or displays a section description, so it's dropped — name
  only, matching the app's other lightweight inline-create patterns
  (Storage's "New folder", TaskDetailModal's "Add sub-task")

## List view: Sections

For Inbox/project views only, **when the project has at least one
section**, the task list groups by section instead of rendering flat:

1. "(No Section)" group first, only if unsectioned tasks exist
2. Each named section, in creation order, even if empty (matches the
   reference showing empty section columns/groups)

Projects with no sections created yet keep today's flat rendering — no
visual change for existing projects until a section is added.

Each section group header: name, task count, a `⋯` menu (Rename /
Delete — same dropdown pattern as `TaskItem`'s menu), and a collapse
chevron. Deleting a section does **not** delete its tasks — they fall
back to "(No Section)", matching real Todoist.

"+ Add section": an inline reveal-input row at the bottom of the section
list (same interaction pattern as `StorageView`'s "New folder" and
`AddTaskForm`'s description reveal) — type a name, Enter to create,
Escape to cancel.

Each section gets its own "+ Add task" row. `AddTaskForm` gains an
optional `defaultSectionId` prop threaded through to `onAdd`, so a task
created under "Wishlist" is born with that `sectionId` set.

## Board view

New `BoardView.tsx` + `.css`, rendered instead of the task list body when
a List/Board toggle (see below) is set to Board, for Inbox/project views
only.

**Grouping toggle** (Section | Date, pill switch, local state inside
`BoardView`):
- **Section** (default): one column per section in creation order, plus a
  leading "No Section" column if unsectioned tasks exist. Empty sections
  still render as empty columns.
- **Date**: four fixed columns — Overdue / Today / Upcoming / No date —
  reusing the same date-comparison logic `MainContent` already uses for
  the Today view's Overdue/Today split.

Columns scroll horizontally when they overflow the viewport. Each column:
header (name + task count + the same `⋯` Rename/Delete menu as List
view's section header, reusing the same handlers — visible in the
reference's Board screenshot too), a vertical stack of `TaskCard`s, and a
"+ Add task" row at the bottom. The Date-mode columns (Overdue / Today /
Upcoming / No date) are fixed and don't get the `⋯` menu — there's
nothing to rename or delete about them.

Board's "+ Add task" is a **simple inline text input** (name only, Enter
to create), not the full `AddTaskForm` card — a bordered/chip-heavy panel
doesn't fit a narrow Kanban column. New tasks get sensible defaults
(priority 4, no labels) plus whatever the column implies (a `sectionId`
in Section mode; nothing extra in Date mode — presetting a due date per
Date-mode column is a reasonable follow-up, not required for this pass).

## TaskCard

New `TaskCard.tsx` + `.css`: a compact bordered card for Board columns —
checkbox (reusing `TaskItem`'s priority-colored circle), title,
description preview (if present), due date badge. Clicking the card body
opens the existing `TaskDetailModal` (reuses `onOpenTask`, already wired
through `MainContent`) — no new modal needed.

## List/Board toggle

A small two-segment pill (List | Board) in `MainContent`'s header, to the
right of the title — rendered only when `activeView === 'inbox' ||
activeView === 'project'`. Local `viewMode` state in `MainContent`; it
isn't reset when switching between projects (matches how the rest of the
app treats view preferences as sticky UI state, not per-project data).
