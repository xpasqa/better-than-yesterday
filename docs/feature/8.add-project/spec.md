# Spec: Add Project dari Sidebar

## 1. Latar Belakang

Tombol `+` di sebelah header **My Projects** di sidebar sudah ada secara visual
(`Sidebar.tsx:228–234`) namun tidak memiliki `onClick` handler. Saat ini
satu-satunya cara membuat project baru adalah via quick-add syntax `#NamaProject`
di task input — sebuah fitur tersembunyi tanpa discoverability.

Tujuan fitur ini: menghadirkan UX tambah project ala Todoist langsung dari
sidebar, tanpa modal/dialog tambahan.

---

## 2. Referensi Kode yang Sudah Ada

| Komponen | Status | Lokasi |
|---|---|---|
| `createProject(name, allNodes)` | ✅ ada | `apps/web/src/store/project-actions.ts:22` |
| State `addingProject` + `newProjectName` | ✅ ada | `Sidebar.tsx:61–62` |
| Ref `newProjectInputRef` | ✅ ada | `Sidebar.tsx:63` |
| `handleAddProjectClick` | ✅ ada (partial) | `Sidebar.tsx:65` |
| `realProjects` derived dari `realNodes` | ✅ ada | `Sidebar.tsx:99–101` |
| Tombol `+` tanpa `onClick` | ❌ belum | `Sidebar.tsx:228` |
| Inline input form | ❌ belum | — |

---

## 3. User Stories

**US-1 — Tambah project baru**
> Sebagai user, saya ingin mengklik `+` di sidebar lalu mengetik nama project
> dan menekan Enter, sehingga project baru langsung muncul di list sidebar.

**US-2 — Batal tambah project**
> Sebagai user, saya ingin menekan Escape (atau klik di luar input) untuk
> membatalkan penambahan project tanpa efek samping.

**US-3 — Navigasi otomatis ke project baru**
> Sebagai user, setelah project dibuat saya ingin langsung dinavigasikan ke
> project tersebut tanpa langkah ekstra.

---

## 4. Acceptance Criteria

### AC-1: Trigger inline input
- Klik tombol `+` di header "My Projects" → section projects otomatis expand
  (jika belum) dan inline input muncul di bawah list project yang sudah ada
- Input langsung mendapat focus (`autoFocus`)

### AC-2: Submit dengan Enter
- Tekan Enter dengan nama non-kosong → `createProject(name, realNodes)` dipanggil
- Project baru muncul di list (reaktif via Dexie live query)
- Input direset ke kosong dan tersembunyi (`addingProject = false`)
- `onProjectChange(newId)` dipanggil sehingga view berpindah ke project baru

### AC-3: Submit dengan nama kosong
- Tekan Enter dengan input kosong → tidak ada project dibuat, input tetap
  tampil (tidak ditutup)

### AC-4: Batal dengan Escape
- Tekan Escape → input tersembunyi, state direset, tidak ada project dibuat

### AC-5: Batal dengan blur (klik di luar)
- `onBlur` pada input → sama seperti AC-4

### AC-6: Duplikat nama
- Nama yang sudah ada (case-insensitive) → project baru tetap dibuat
  (sama seperti perilaku `createProject` saat ini — tidak ada validasi duplikat
  di action layer, konsisten dengan quick-add)

### AC-7: Persistensi
- Project tersimpan ke Dexie dan masuk outbox sync ke server
- Setelah hard refresh, project tetap muncul

### AC-8: Aksesibilitas
- Input memiliki `aria-label="Project name"`
- Tombol `+` memiliki `aria-expanded={addingProject}`

---

## 5. Desain Interaksi

```
[My Projects]  [+]  [v]
  # Work
  # Personal
  ┌─────────────────────────┐
  │  # _                    │  ← inline input, auto-focus
  └─────────────────────────┘
```

- Prefix `#` ditampilkan di sebelah kiri input (konsisten dengan item project lain)
- Placeholder teks: `"Project name"`
- Tidak ada tombol konfirmasi — Enter untuk submit, Escape/blur untuk batal

---

## 6. Data Model

Tidak ada perubahan data model. Project baru adalah `Node` dengan:

```ts
{
  kind: 'project',
  parentId: null,
  content: name.trim(),
  isInbox: false,
  // semua field lain default seperti di createProject()
}
```

---

## 7. Batasan Scope

- **Tidak termasuk** dalam fitur ini: pemilihan warna project, icon project,
  edit nama project, hapus project — masing-masing feature terpisah
- **Tidak termasuk**: migrasi/penghapusan mock `allProjects` dari `mockData.ts`
  (ini item terpisah di roadmap backend migration)
- Mock projects dari `mockData.ts` tetap ditampilkan berdampingan dengan
  `realProjects` sampai migrasi selesai (tidak diubah di sini)

---

## 8. File yang Akan Diubah

1. `apps/web/src/components/Sidebar.tsx` — pasang `onClick`, render inline input
2. `apps/web/src/components/Sidebar.css` — style untuk inline input jika belum ada
