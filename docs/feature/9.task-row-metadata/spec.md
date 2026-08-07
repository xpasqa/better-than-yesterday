# Spec: TaskRow Metadata & Feature Parity

## Objective

Membawa semua real (store-backed) views — Today, Inbox, Upcoming, Project — ke
paritas visual dan fungsional dengan frontend mock (`TaskItem.tsx` +
`TaskDetailModal.tsx`) yang sudah mengimplementasi UX Todoist secara lengkap.

**User:** Pasqa — satu-satunya user aktif di https://bty.xvntr.my.id

**Success:** User bisa melihat semua metadata task (due date, due time, project,
labels, priority), membuka detail task untuk mengeditnya, dan UX terasa
konsisten dengan Todoist.

---

## Tech Stack

- React 19 + TypeScript + Vite
- CSS polos (BEM-style, tanpa Tailwind)
- Dexie (IndexedDB) sebagai local store
- `@phosphor-icons/react` untuk icons
- `@dnd-kit/core` untuk drag & drop (sudah ada, belum dipakai di real views)
- Node type dari `packages/core/src/node.ts`
- Label type dari `packages/core/src/label.ts`

---

## Commands

```bash
# Type check
cd apps/web && npx tsc --noEmit

# Build
sudo chown -R ubuntu:ubuntu apps/web/node_modules/.vite-temp apps/web/node_modules/.tmp apps/web/dist 2>/dev/null || true
node_modules/.bin/vite build --config apps/web/vite.config.ts

# Deploy (dari repo root)
sudo cp -r apps/web/dist/. /var/www/bty.xvntr.my.id/
sudo nginx -s reload

# Lint
npm run lint

# Test
npm run test --workspace=apps/web
```

---

## Project Structure

```
apps/web/src/
├── components/
│   ├── TaskRow.tsx          ← komponen task di semua real views
│   ├── TaskRow.css
│   ├── TaskItem.tsx         ← referensi mock (jangan diubah)
│   ├── TaskItem.css         ← referensi mock (jangan diubah)
│   ├── TaskDetailModal.tsx  ← referensi modal mock (jangan diubah)
│   ├── NodeDetailModal.tsx  ← (baru) modal edit untuk Node
│   ├── NodeDetailModal.css  ← (baru)
│   ├── QuickAddBar.tsx      ← inline add task bar
│   ├── ProjectReal.tsx      ← project view dengan sections
│   ├── TodayReal.tsx        ← today view
│   ├── InboxReal.tsx        ← inbox view
│   └── UpcomingReal.tsx     ← upcoming view
├── store/
│   ├── node-actions.ts      ← createTask, toggleComplete, deleteTask, updateNode (baru)
│   └── use-nodes.ts         ← Dexie live query hooks
└── packages/core/src/
    ├── node.ts              ← Node type
    └── label.ts             ← Label type
```

---

## Gap Analysis

### Metadata Display di TaskRow

| Field | Mock TaskItem | TaskRow Saat Ini | Node Field | Gap |
|---|---|---|---|---|
| Title | ✅ | ✅ | `content` | — |
| Description | ✅ `description` | ✅ `note` | `note` | — |
| Due date formatted | ✅ Today/Tomorrow/overdue | ✅ | `dueDate` | — |
| Due time | ❌ | ❌ | `dueTime` | **P0**: tambah ke meta row |
| Labels (colored) | ✅ | ✅ | `labelIds` | — |
| Priority flag hover | ✅ | ✅ | `priority` | — |
| Project name | ✅ | ❌ | `parentId` → lookup | **P0**: tampilkan di Today/Inbox/Upcoming |
| Recurrence indicator | ❌ | ❌ | `recurrence` | P3 |
| Duration | ❌ | ❌ | `durationMin` | P3 |
| Sub-tasks count | ✅ (mock) | ❌ | tidak ada di Node | fitur terpisah |

### Interaksi di TaskRow

| Interaksi | Mock TaskItem | TaskRow Saat Ini | Gap |
|---|---|---|---|
| Toggle complete | ✅ | ✅ | — |
| Open detail modal | ✅ klik content | ❌ | **P1**: `NodeDetailModal` |
| Delete task | ✅ | ✅ | — |
| Hover actions | ✅ | ✅ | — |
| Drag & drop reorder | ✅ | ❌ | P3 |

### QuickAddBar

| Fitur | Status | Gap |
|---|---|---|
| Natural language parsing | ✅ | — |
| Due date/time via teks | ✅ | — |
| `#project`, `$label`, `!priority` | ✅ | — |
| Visual styling | ❌ plain input | **P2**: redesign agar mirip Todoist |
| Inline expand dengan pickers | ❌ | P2 |

### Sistem yang Belum Terimplementasi

| Sistem | Deskripsi | Prioritas |
|---|---|---|
| Due time display | `dueTime` ada di Node, belum render | P0 |
| Project name di Today/Inbox | Lookup `parentId` → tampilkan nama | P0 |
| NodeDetailModal | Edit title, note, due date, priority, labels | P1 |
| `updateNode` action | Patch node di Dexie + outbox | P1 |
| Label management UI | Create/edit/delete label | P1 |
| Sections di ProjectReal | Render `kind='section'` sebagai group header | P2 |
| QuickAddBar redesign | Visual Todoist-style inline add | P2 |
| Drag & drop reorder | dnd-kit di real views | P3 |
| Recurrence indicator | Tampilkan RRULE di meta row | P3 |

---

## Code Style

Ikuti pola `TaskItem.tsx` — komponen ini adalah referensi visual ground truth:

```tsx
// BEM class naming
<li className={['task-row', done && 'task-row--done'].filter(Boolean).join(' ')}>
  <button className="task-row__checkbox task-row__checkbox--p1" />
  <div className="task-row__content">
    <p className="task-row__title">{node.content}</p>
    <div className="task-row__meta">
      <span className="task-row__due task-row__due--today">
        <CalendarBlankIcon size={12} /> Today
      </span>
    </div>
  </div>
</li>

// Async actions — void, tidak throw ke UI
onClick={() => void toggleTaskComplete(node)}

// CSS: gunakan CSS variables dari variables.css
// Contoh: var(--priority-p1), var(--text-secondary), var(--bg-raised)
```

---

## Testing Strategy

- Framework: Vitest
- Test location: `apps/web/src/**/*.test.ts`
- Coverage requirement: tidak ada minimum saat ini
- Fokus: type check (`tsc --noEmit`) sebagai gate utama
- Manual verification di browser https://bty.xvntr.my.id setelah deploy

---

## Boundaries

- **Always:** `tsc --noEmit` hijau sebelum build; ikuti BEM naming; gunakan CSS variables
- **Ask first:** tambah npm dependency baru; ubah Node/Label type di `packages/core`; ubah schema Dexie
- **Never:** ubah `TaskItem.tsx` / `TaskDetailModal.tsx` (referensi mock); commit secret; hapus field dari Node type

---

## Prioritas Implementasi

### P0 — Segera (data sudah ada, tinggal render)
1. **Due time di meta row** — `node.dueTime` → tampilkan setelah due date, format `HH:MM`
2. **Project name di Today/Inbox/Upcoming** — lookup `node.parentId` dari `allNodes`, tampilkan `#ProjectName` di meta row

### P1 — Core missing (UX broken tanpa ini)
3. **`updateNode` di node-actions.ts** — patch node di Dexie + outbox
4. **NodeDetailModal** — edit title, note, due date, due time, priority, labels; menerima `Node` bukan `Task`
5. **Label management** — create label minimal (name + color picker)

### P2 — Polish
6. **Sections di ProjectReal** — render `kind='section'` sebagai group header dengan task count
7. **QuickAddBar redesign** — visual mirip Todoist inline add bar

### P3 — Nice to have
8. **Drag & drop reorder** di real views
9. **Recurrence indicator** di meta row

---

## Success Criteria

- [ ] Due time tampil di meta row jika ada (`node.dueTime !== null`)
- [ ] Project name tampil di Today/Inbox/Upcoming meta row (kecuali di ProjectReal sendiri)
- [ ] Klik content area TaskRow → NodeDetailModal terbuka dengan data task
- [ ] Edit title di NodeDetailModal → tersimpan di Dexie + outbox
- [ ] Edit due date/priority/labels → tersimpan
- [ ] `tsc --noEmit` hijau setelah semua perubahan
- [ ] Visual konsisten dengan `TaskItem.tsx` — tidak ada elemen UI yang lebih jelek dari mock

---

## Open Questions

1. NodeDetailModal: apakah pakai portal (`createPortal`) seperti `TaskDetailModal`, atau
   render inline di bawah task row?
   → **Asumsi: pakai portal, konsisten dengan pola yang ada**

2. Label management: apakah butuh halaman tersendiri atau cukup modal kecil?
   → **Asumsi: modal kecil, bisa dipanggil dari NodeDetailModal**

3. Sections: apakah task bisa dipindah antar section via drag & drop, atau cukup
   ditampilkan sebagai group dulu?
   → **Asumsi: tampilkan sebagai group dulu, drag & drop menyusul di P3**
