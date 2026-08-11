# Undo (⌘Z) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One-slot, session-only undo for "hapus task" and "centang selesai task biasa" (non-recurring), surfaced as a toast that auto-dismisses after 5 seconds.

**Architecture:** A tiny in-memory pub/sub store (`undo-store.ts`, mirrors the existing `sync-client.ts` `SyncStatus` pattern) holds at most one pending `UndoAction`. `deleteTask` and the non-recurring branch of `toggleTaskComplete` record an action into it after their write succeeds. A single `UndoToast` component, mounted once in `App.tsx`, subscribes to the store and renders the toast; clicking "Undo" calls `updateNode` directly to reverse the one field that changed.

**Tech Stack:** React 19, TypeScript, Dexie (existing `node-actions.ts` write path) — no new dependencies.

## Global Constraints

- **Session-only, no `localStorage`.** State lives in a module-level variable; a reload silently discards it (spec §2).
- **One slot, not a stack.** A new undoable action always replaces the pending one — never queue multiple toasts (spec §5).
- **No snapshot needed.** Both supported actions are binary field flips (`deletedAt`/`completedAt`: `null` ↔ a timestamp), so undo only needs `nodeId` + action `type` (spec §3).
- **Recurring-task completion is out of scope.** Never call `recordUndo` from the recurring branch of `toggleTaskComplete` — the `completion` row it writes is immutable server-side and cannot be reversed (spec §2).
- **Undoing an action must not itself be undoable.** The undo handler calls `updateNode` directly, never `deleteTask`/`toggleTaskComplete` (spec §5).
- **5000ms auto-dismiss**, timer resets on every new `recordUndo` call (spec §5).
- Reuse existing CSS tokens from `apps/web/src/styles/variables.css` (`--bg-raised`, `--shadow-raised-2`, `--border-radius-large`, `--text-tertiary`, `--brand-red-idle`) — already theme-aware (light/dark), don't hardcode colors.

---

### Task 1: `undo-store.ts` — the pub/sub store

**Files:**
- Create: `apps/web/src/store/undo-store.ts`

**Interfaces:**
- Produces: `UndoAction = { type: 'delete' | 'complete'; nodeId: string; label: string }`, `recordUndo(action: UndoAction): void`, `clearUndo(): void`, `getPendingUndo(): UndoAction | null`, `onUndoChange(listener: (action: UndoAction | null) => void): () => void`

No test file — this module lives in `apps/web/src/store`, not `packages/core`, and the project's engineering policy (§7) deliberately does not unit-test Dexie-touching store files one by one; verification for this whole feature is a real end-to-end browser check in Task 4. This task has no failing-test step for that reason — write the implementation directly, matching the existing pattern in `apps/web/src/store/sync-client.ts:9-29` (the `SyncStatus` pub/sub) exactly.

- [ ] **Step 1: Write `undo-store.ts`**

```ts
// Session-only, one-slot undo (issue #76 — docs/feature/29.undo/spec.md).
// Not a history stack: a new undoable action always replaces the pending
// one. State lives in memory only — a reload silently discards it (spec §2).
export interface UndoAction {
  type: 'delete' | 'complete'
  nodeId: string
  label: string
}

type Listener = (action: UndoAction | null) => void
const listeners = new Set<Listener>()
let pending: UndoAction | null = null
let dismissTimer: ReturnType<typeof setTimeout> | undefined

const TOAST_DURATION_MS = 5000

function notify(): void {
  for (const listener of listeners) listener(pending)
}

/** Records a new undoable action, replacing whatever was pending, and (re)starts the 5s auto-dismiss timer. */
export function recordUndo(action: UndoAction): void {
  pending = action
  notify()
  if (dismissTimer) clearTimeout(dismissTimer)
  dismissTimer = setTimeout(() => {
    pending = null
    notify()
  }, TOAST_DURATION_MS)
}

/** Clears the pending action without performing it — called once the user has undone it, so the toast disappears immediately instead of waiting out the timer. */
export function clearUndo(): void {
  if (dismissTimer) clearTimeout(dismissTimer)
  pending = null
  notify()
}

export function getPendingUndo(): UndoAction | null {
  return pending
}

export function onUndoChange(listener: Listener): () => void {
  listeners.add(listener)
  listener(pending)
  return () => listeners.delete(listener)
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passes with no errors (this is a new, self-contained file — nothing else imports it yet, so this just confirms the file itself compiles).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/store/undo-store.ts
git commit -m "feat(#76): add undo-store, a session-only one-slot pub/sub for undoable actions"
```

---

### Task 2: Wire `recordUndo` into `deleteTask` and `toggleTaskComplete`

**Files:**
- Modify: `apps/web/src/store/node-actions.ts:126-164`

**Interfaces:**
- Consumes: `recordUndo` from Task 1 (`apps/web/src/store/undo-store.ts`)

This task has no automated test for the same reason as Task 1 (Dexie-touching store code, policy §7) — it's verified end-to-end in Task 4. Read the current code first so the edit lands exactly:

```ts
export async function toggleTaskComplete(node: Node, timezone: string): Promise<void> {
  const now = new Date().toISOString()

  if (!node.completedAt && node.recurrence && node.dueDate) {
    const completion: Completion = {
      id: uuidv7(),
      userId: '',
      nodeId: node.id,
      completedAt: now,
      occurredOn: node.dueDate,
      seq: 0,
    }
    const nextDueDate = nextOccurrenceAfter(node.recurrence, node.dueDate, todayInTimezone(timezone))
    const advanced: Node = { ...node, dueDate: nextDueDate, updatedAt: now }

    await db.transaction('rw', db.nodes, db.completions, db.outbox, async () => {
      await db.nodes.put(advanced)
      await db.outbox.put({ key: `node:${advanced.id}`, entityType: 'node', payload: advanced })
      await db.completions.put(completion)
      await db.outbox.put({ key: `completion:${completion.id}`, entityType: 'completion', payload: completion })
    })
    triggerSync()
    return
  }

  await enqueue({ ...node, completedAt: node.completedAt ? null : now, updatedAt: now })
}
```

```ts
export async function deleteTask(node: Node): Promise<void> {
  const now = new Date().toISOString()
  await enqueue({ ...node, deletedAt: now, updatedAt: now })
}
```

- [ ] **Step 1: Add the import**

In `apps/web/src/store/node-actions.ts`, add alongside the other local imports (near the top of the file, with `import { triggerSync } from './sync-client.ts'`):

```ts
import { recordUndo } from './undo-store.ts'
```

- [ ] **Step 2: Record undo in the non-recurring completion branch**

Replace the final line of `toggleTaskComplete` —

```ts
  await enqueue({ ...node, completedAt: node.completedAt ? null : now, updatedAt: now })
}
```

— with:

```ts
  const completing = !node.completedAt
  await enqueue({ ...node, completedAt: completing ? now : null, updatedAt: now })
  if (completing) recordUndo({ type: 'complete', nodeId: node.id, label: node.content })
}
```

The recurring branch above it (the early `return` inside the `if (!node.completedAt && node.recurrence && node.dueDate)` block) is untouched — no `recordUndo` call there, by design (Global Constraints).

- [ ] **Step 3: Record undo in `deleteTask`**

Replace:

```ts
export async function deleteTask(node: Node): Promise<void> {
  const now = new Date().toISOString()
  await enqueue({ ...node, deletedAt: now, updatedAt: now })
}
```

with:

```ts
export async function deleteTask(node: Node): Promise<void> {
  const now = new Date().toISOString()
  await enqueue({ ...node, deletedAt: now, updatedAt: now })
  recordUndo({ type: 'delete', nodeId: node.id, label: node.content })
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: passes with no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/store/node-actions.ts
git commit -m "feat(#76): record undo action on delete and non-recurring complete"
```

---

### Task 3: `UndoToast` component + mount in `App.tsx`

**Files:**
- Create: `apps/web/src/components/UndoToast.tsx`
- Create: `apps/web/src/components/UndoToast.css`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `onUndoChange`, `clearUndo`, `type UndoAction` from Task 1 (`../store/undo-store.ts`); `updateNode` from `../store/node-actions.ts` (already exported, signature `updateNode(id: string, patch: Partial<Omit<Node, 'id' | 'userId' | 'createdAt' | 'seq'>>): Promise<void>`)

No component-level test — the project's policy (§7) explicitly replaces per-component React tests with real E2E flows, which is Task 4 here.

- [ ] **Step 1: Write `UndoToast.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react'
import { onUndoChange, clearUndo, type UndoAction } from '../store/undo-store'
import { updateNode } from '../store/node-actions'
import './UndoToast.css'

const MESSAGES: Record<UndoAction['type'], (label: string) => string> = {
  delete: (label) => `"${label}" deleted`,
  complete: (label) => `"${label}" completed`,
}

/** Global toast for the one pending undoable action (issue #76) — mounted once in App.tsx, renders nothing when there's nothing to undo. */
function UndoToast() {
  const [action, setAction] = useState<UndoAction | null>(null)
  useEffect(() => onUndoChange(setAction), [])

  if (!action) return null

  async function handleUndo() {
    if (!action) return
    // Cleared first, synchronously, so the toast disappears immediately on
    // click rather than lingering until the write below resolves.
    clearUndo()
    if (action.type === 'delete') {
      await updateNode(action.nodeId, { deletedAt: null })
    } else {
      await updateNode(action.nodeId, { completedAt: null })
    }
  }

  return (
    <div className="undo-toast" role="status">
      <span className="undo-toast__message">{MESSAGES[action.type](action.label)}</span>
      <button className="undo-toast__button" type="button" onClick={() => void handleUndo()}>
        <ArrowCounterClockwiseIcon size={14} />
        Undo
      </button>
    </div>
  )
}

export default UndoToast
```

- [ ] **Step 2: Write `UndoToast.css`**

```css
.undo-toast {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: var(--bg-raised);
  border-radius: var(--border-radius-large);
  box-shadow: var(--shadow-raised-2);
  /* Above the date-picker dropdown portal (1100, NodeDetailModal.css) so an
     undo toast triggered from within a modal is never hidden behind it. */
  z-index: 1200;
}

.undo-toast__message {
  font-size: 14px;
  color: var(--text-primary, inherit);
}

.undo-toast__button {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  color: var(--brand-red-idle);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 8px;
}

.undo-toast__button:hover {
  text-decoration: underline;
}
```

- [ ] **Step 3: Mount in `App.tsx`**

Add the import near the other component imports (alongside `import ShortcutsModal from './components/ShortcutsModal'`):

```ts
import UndoToast from './components/UndoToast'
```

Add `<UndoToast />` right before the closing `</div>` of `app-shell`, after `<BottomNav onMorePress={() => setDrawerOpen(true)} />`:

```tsx
      <BottomNav onMorePress={() => setDrawerOpen(true)} />
      <UndoToast />
    </div>
  )
}
```

- [ ] **Step 4: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both pass with no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/UndoToast.tsx apps/web/src/components/UndoToast.css apps/web/src/App.tsx
git commit -m "feat(#76): add UndoToast component, mount globally in App.tsx"
```

---

### Task 4: Real browser verification

**Files:** none (no code changes — this task produces evidence, not a diff)

This project's workflow policy requires verification to be genuinely run, not just claimed (`docs/policy/2-workflow.md` §2, "Review" gate). Every feature landed this session was checked this way — this task is not optional polish.

Prerequisite: dev servers running (`npm run dev -w @better/api` on a free port, `npm run dev -w @better/web` with `DEV_API_PORT` pointing at it — see `playwright.config.ts` for the exact pattern already used this session), a test user created via `npm run user -- add <email> <name>`.

- [ ] **Step 1: Verify delete + undo**

In the browser: create a task, delete it (row menu → Delete task), confirm the toast reads `"<task name>" deleted` with an Undo button, click Undo, confirm the task reappears in its original list. Then query Postgres directly to confirm `deleted_at` is `NULL` again:

```bash
docker exec app-postgres-1 psql -U better -d better -c "select content, deleted_at from node where content = '<task name>'"
```

Expected: `deleted_at` is empty/NULL.

- [ ] **Step 2: Verify complete + undo (non-recurring)**

Create a plain (non-recurring) task, click its checkbox to complete it, confirm the toast reads `"<task name>" completed`, click Undo, confirm the task shows as incomplete again (checkbox unchecked, back in the active list). Query Postgres:

```bash
docker exec app-postgres-1 psql -U better -d better -c "select content, completed_at from node where content = '<task name>'"
```

Expected: `completed_at` is empty/NULL.

- [ ] **Step 3: Verify recurring completion shows no toast (out of scope, spec §2)**

Create a recurring task (e.g. `siram tanaman setiap hari`), click its checkbox to complete it. Confirm **no undo toast appears** — the task should simply advance to its next occurrence as it did before this feature existed, with no "Undo" affordance.

- [ ] **Step 4: Verify one-slot replacement**

Delete task A, then — before 5 seconds pass — delete task B. Confirm the toast now reads `"B" deleted` (not A), and clicking Undo restores only B. Directly query Postgres to confirm A is still `deleted_at IS NOT NULL`:

```bash
docker exec app-postgres-1 psql -U better -d better -c "select content, deleted_at from node where content in ('A', 'B')"
```

Expected: A's `deleted_at` is still set; B's is `NULL` after undo.

- [ ] **Step 5: Verify auto-dismiss and reload discards state**

Delete a task, wait 6+ seconds without clicking Undo, confirm the toast disappears on its own. Reload the page and confirm there is no lingering undo affordance and no console error.

- [ ] **Step 6: Full verify suite**

Run: `npm run typecheck && npm run lint && npm run test -w @better/core -w @better/web && npm run build`

(API tests need `TEST_DATABASE_URL` pointed at a migrated Postgres if the shared test DB isn't already current — check `apps/api/test/setup.ts` for the default and override if needed, same as established earlier this session.)

Expected: all green. This feature adds no new automated tests (per Global Constraints and Task 1/2/3 notes), so "green" here means "nothing regressed" — Steps 1-5 above are what actually prove the feature works.

- [ ] **Step 7: Update `docs/feature/29.undo/todo.md` and close out**

Create `docs/feature/29.undo/todo.md`:

```markdown
# Todo: Undo (⌘Z)

Checklist hidup ada di issue **[#76](https://github.com/xpasqa/better-than-yesterday/issues/76)**.

Rincian langkah: [plan.md](plan.md). Alasan tiap keputusan: [spec.md](spec.md).

## Status

- [x] Task 1 — undo-store
- [x] Task 2 — wire recordUndo into deleteTask/toggleTaskComplete
- [x] Task 3 — UndoToast component + mount
- [x] Task 4 — verifikasi browser sungguhan
```

```bash
git add docs/feature/29.undo/todo.md
git commit -m "docs(#76): mark undo feature todo complete"
git push origin master
```

Close issue #76 on GitHub with a comment summarizing what was verified (delete+undo, complete+undo, recurring exclusion, one-slot replacement, auto-dismiss) and the commit hashes, per the pattern used for every other feature closed this session.
