# Spec: Area → Project — struktur ala Things

**Tanggal:** 2026-08-08
**Status:** disetujui, siap diimplementasi
**Menutup:** issue #29
**Merevisi:** `1.todo/spec.md` §3.1 (kedalaman nested — lihat §4.1)

---

## 1. Konteks

Issue #29 awalnya cuma soal warna project. Dua putaran penelusuran mengubah
bentuknya sepenuhnya:

1. Ternyata `1.todo/spec.md` §3.1 sudah menjanjikan **warna, favorit, dan
   nested project** sejak awal — ketiganya tidak pernah ada di UI.
2. Lalu diputuskan mengikuti model **Things 3 (Cultured Code)**: bukan
   "project di dalam project", melainkan **Area → Project → Task**.

Perubahan kedua itu yang menentukan, dan justru **menyederhanakan**: dua
tingkat dengan nama dan makna berbeda jauh lebih jelas daripada satu benda
yang bersarang di dirinya sendiri.

---

## 2. Riset: model Things 3

Diverifikasi dari dokumentasi resmi Cultured Code, terutama halaman
Shortcuts Actions yang memuat matriks field per tipe.

### Empat tipe

| Tipe | Kata Cultured Code | Selesai? |
|---|---|---|
| **Area** | *"grouping all of your projects and to-dos that support an **ongoing ambition**"* — "every hat you wear" (Family, Health, Career) | **tidak pernah** |
| **Project** | *"things that actually take **more than a single step** to complete"* | ya |
| **Heading** | pembagi di dalam project — *"categories, milestones"* | (diarsipkan bersama isinya) |
| **To-Do** | *"your basic building block"* | ya |

### Matriks field (dari dokumentasi Shortcuts Actions)

| Field | To-Do | Heading | Project | Area |
|---|---|---|---|---|
| Checklist | ✓ | ✗ | ✗ | ✗ |
| Notes | ✓ | ✗ | ✓ | ✗ |
| Deadline | ✓ | ✗ | ✓ | ✗ |
| Tags | ✓ | ✗ | ✓ | ✓ |

Dua hal yang paling menjelaskan filosofinya:

- **Area tidak punya deadline maupun notes.** Karena area bukan pekerjaan —
  ia wadah. Sesuatu yang tidak pernah selesai tidak butuh tenggat.
- **Checklist hanya milik To-Do.** *"Some things take several steps to
  complete but don't require a full-blown project. For those cases we now
  have checklists."* Checklist adalah jalan tengah antara satu task dan satu
  project.

**Heading hanya ada di project** — *"This feature is not available in areas
or any other list."*

**Project tidak bersarang di project.** Dokumentasi Things tidak pernah
menyebut project di dalam project; hierarkinya Area → Project, titik.

---

## 3. Pemetaan ke model `node` yang sudah ada

Kabar baiknya: model `node` di app ini hampir seluruhnya sudah cocok.

| Things | Di app ini | Status |
|---|---|---|
| Area | `kind='area'` | **BARU** — perlu migrasi enum + CHECK |
| Project | `kind='project'` | sudah ada |
| Heading | `kind='section'` | sudah ada (belum dirender — milik Board) |
| To-Do | `kind='item'` | sudah ada |
| Notes | `node.note` | **sudah jalan** di `NodeDetailModal` |
| Checklist item | anak `item` dari sebuah `item` | ada di model, belum dirender |
| Tags | `node.labelIds` | sudah jalan |

### Satu perbedaan yang disengaja: checklist = subtask

Di Things, checklist item **lebih miskin** dari to-do — dokumentasinya tegas:
tidak bisa punya tanggal, tag, maupun notes. Things bahkan **tidak punya
subtask sama sekali**; checklist justru dibuat sebagai jalan tengah supaya
orang tidak membuat project untuk hal sepele.

Di app ini keputusannya sudah diambil lebih dulu, dan berlawanan —
`1.todo/spec.md` §3.1:

> **Subtask tanpa batas kedalaman.** Todoist membatasinya [...] Di sini justru
> sebaliknya — subtask *adalah* outline, jadi batasan itu kehilangan alasannya.

Jadi di sini **checklist dan subtask adalah benda yang sama**: anak `item`
dari sebuah `item`, node penuh. Membuat tipe "checklist" yang lebih miskin
berarti melawan keputusan §3.1 sekaligus menambah satu `kind` berikut aturan
pembatasnya — demi membedakan dua hal yang di app ini memang satu.

Yang berbeda cuma **cara menampilkannya**: checkbox ringkas di dalam task
detail, bukan baris penuh di daftar.

**Tradeoff yang diterima:** karena subtask adalah node penuh, subtask yang
diberi tanggal akan muncul sendiri di Today. Di Things itu mustahil. Tapi itu
sudah jadi perilaku app ini hari ini — bukan masalah baru yang diciptakan
fitur ini.

**Konsekuensi:** menampilkan subtask bukan bagian spec ini. Ia fitur
tersendiri — lihat `docs/feature/14.task-subtask-view/`.

---

## 4. Keputusan desain

### 4.1 Area menggantikan sub-project

`1.todo/spec.md` §3.1 semula menulis "project boleh nested, kedalaman tidak
dibatasi". **Direvisi:** hierarkinya **Area → Project**, dan **project tidak
pernah bersarang di project**.

Kenapa ini lebih baik daripada sub-project:

- **Semantiknya tegas.** "Project di dalam project" tidak menjawab kapan
  sesuatu layak jadi sub-project. "Area = tanggung jawab berkelanjutan,
  Project = pekerjaan yang selesai" menjawabnya dengan sendirinya.
- **Siklus mustahil secara struktural.** Induk sebuah project hanya boleh
  `area` atau `null`. Karena `area` dan `project` beda `kind`, A→B→A tidak
  bisa terjadi — tanpa perlu `wouldCreateCycle`, tanpa tes siklus, tanpa
  pesan error. Aturan yang lebih tegas **menghapus** kode.
- **Indentasi sidebar sepele** — dua tingkat, tanpa rekursi.

### 4.2 Area tidak punya tanggal dan tidak bisa diselesaikan

Mengikuti Things, dan alasannya kuat: area adalah wadah, bukan pekerjaan.
Ditegakkan di UI (tidak ada field tanggal di form area) — **bukan** dengan
CHECK constraint baru, karena kolomnya memang dipakai `kind` lain di tabel
yang sama.

### 4.3 Hapus = soft-delete beserta seluruh isinya

Dokumentasi Things maupun Todoist tidak menjawab ini, jadi keputusan sendiri.

Tiga pilihan: hapus semuanya, pindahkan isinya ke Inbox, atau tolak menghapus
yang tidak kosong. **Dipilih hapus semuanya** — memindahkan 40 task ke Inbox
tanpa diminta adalah kejutan yang lebih buruk daripada menghapus, dan menolak
menghapus membuat wadah mati tidak bisa dibersihkan.

Karena `deletedAt` sudah soft-delete, datanya tetap ada di Postgres.

**Konfirmasi wajib menyebut angka sebenarnya** — "Hapus area *Kerja*? 3
project dan 27 task ikut terhapus." Dialog "yakin?" tidak memberi informasi
untuk memutuskan.

### 4.4 Favorit: project saja, bukan area

Things mengizinkan tag di area, tapi sidebar-nya sudah mengelompokkan project
di bawah area — jadi area **sudah** berfungsi sebagai pengelompokan. Favorit
gunanya menarik **project tertentu** ke atas, melewati areanya.

Memfavoritkan area berarti menaikkan seluruh isinya, yang sama saja dengan
tidak menyaring apa-apa. Jadi: `isFavorite` hanya bermakna di `kind='project'`.

Project favorit **tetap muncul juga** di bawah areanya — menghilangkannya
menambah kasus khusus dan membuat orang bingung mencari project yang "hilang".

### 4.5 Dropdown, bukan drag-and-drop

Things dan Todoist dua-duanya memakai drag. Kita tidak: dropdown menghasilkan
hal yang sama persis dengan pekerjaan berlipat kali lebih sedikit (sensor,
drop indicator, penghitungan rank). Bisa ditambahkan nanti di atas store yang
sama.

### 4.6 Yang tetap disalin, bukan diabstraksi

`COLOR_SWATCHES` disalin dari `CreateLabelModal.tsx`.
`1-engineering-policy.md` §1: *"Jangan bikin abstraksi sebelum pemakaian
ketiga."* Ini pemakaian kedua.

---

## 5. Scope

**In:**
- `kind='area'` — migrasi, tipe core, DTO sync
- Area bisa dibuat, di-rename, diberi warna, dihapus
- Project bisa ditempatkan di dalam area, dipindah antar-area, difavoritkan
- Sidebar: Area → Project, plus section Favorites
- Hapus (area maupun project) beserta seluruh isinya

**Out (dengan alasan):**
- **Menampilkan subtask di dalam task** — fitur tersendiri, `14.task-subtask-view`. Tidak
  berbagi satu baris kode pun dengan spec ini.
- **Merender `kind='section'`** (heading) — milik Board, blok F `1.todo`.
- **Arsip.** Things dan Todoist punya arsip *dan* hapus. Kita cukup hapus
  dulu — arsip adalah kolom baru + view baru + jalur pemulihan, demi kasus
  yang belum pernah muncul.
- **Restore yang terhapus** — datanya aman (soft-delete), bisa ditambah kapan
  pun tanpa migrasi; UI-nya belum dibutuhkan.
- **Drag-and-drop.**
- **Deadline di project.** Things punya, kita belum — `dueDate` sudah ada di
  kolomnya, tapi menampilkannya di project butuh keputusan sendiri soal apa
  artinya project "lewat tenggat".

---

## 6. Blok kerja

### A. Migrasi & core — `kind='area'`

Empat tempat mengunci daftar `kind`, semuanya harus diperbarui:

| Tempat | Perubahan |
|---|---|
| `apps/api/src/db/schema/node.ts:32` | `enum: ['area','project','section','item']` |
| `apps/api/src/db/schema/node.ts:64` | CHECK `in ('area','project','section','item')` |
| `packages/core/src/node.ts:5` | `NodeKind` tambah `'area'` |
| `apps/api/src/modules/sync/dto.ts:9` | `z.enum([...])` tambah `'area'` |

Plus migrasi SQL: `DROP CONSTRAINT node_kind_check` lalu `ADD CONSTRAINT`
dengan daftar baru. Kolom `kind` sendiri `text`, jadi tidak ada perubahan tipe.

### B. Store — `apps/web/src/store/project-actions.ts`

```ts
export async function createArea(name: string, color: string, allNodes: Node[]): Promise<string>

export async function createProject(
  name: string, color: string, areaId: string | null, allNodes: Node[],
): Promise<string>

export async function updateNodeMeta(
  id: string,
  patch: { name?: string; color?: string; parentId?: string | null; isFavorite?: boolean },
  allNodes: Node[],
): Promise<void>

/** Soft-delete node + seluruh keturunannya. */
export async function deleteWithDescendants(id: string, allNodes: Node[]): Promise<void>

/** Untuk dialog konfirmasi. */
export function countDescendants(id: string, allNodes: Node[]): { projects: number; tasks: number }
```

Invarian yang ditegakkan `updateNodeMeta`:

> `parentId` sebuah **project** hanya boleh `null` atau id node ber-`kind='area'`.
> Sebuah **area** selalu `parentId: null`.

Ini yang membuat siklus mustahil. Tulis alasannya di komentar supaya tidak
ada yang "melengkapi" dengan cycle-check yang tidak berguna.

### C. Modal — `ProjectModal.tsx`

Satu komponen, dua mode (`create` | `edit`) **dan** dua tipe (`area` |
`project`) — form yang sama, field yang aktif berbeda:

| Field | Area | Project |
|---|---|---|
| Nama | ✓ | ✓ |
| Warna | ✓ | ✓ |
| Area induk | — | ✓ (dropdown, default "Tanpa area") |
| Favorit | — | ✓ |
| Hapus (mode edit) | ✓ | ✓ |

### D. Sidebar

- Section **Favorites** di atas, isi project ber-`isFavorite`
- Lalu daftar **Area**, masing-masing dengan project di bawahnya (indentasi
  satu langkah)
- Project tanpa area tampil di kelompok terakhir tanpa judul
- Aksi edit per baris → `ProjectModal`
- Badge hitungan **tidak disentuh** — `computeProject` sudah subtree-wide,
  jadi hitungan area otomatis mencakup seluruh project di dalamnya

---

## 7. Success Criteria

- [ ] Bisa membuat area, memberinya nama dan warna
- [ ] Bisa membuat project di dalam area, dan memindahnya antar-area
- [ ] Project **tidak bisa** dijadikan induk project lain
- [ ] Sidebar menampilkan Area → Project dengan indentasi benar
- [ ] Project tanpa area tetap tampil (kelompok tanpa judul)
- [ ] Favorit bisa di-toggle di project; muncul di Favorites **dan** di areanya
- [ ] Hapus area menghapus seluruh project dan task di bawahnya
- [ ] Konfirmasi hapus menyebut jumlah project dan task yang ikut terhapus
- [ ] Badge hitungan area mencakup task dari seluruh project di dalamnya
- [ ] Project lama (`parentId: null`) tetap tampil normal
- [ ] `npm run verify` hijau

---

## Sumber

- [Things Shortcuts Actions](https://culturedcode.com/things/support/articles/9596775/) — matriks field per tipe
- [Getting Productive with Things](https://culturedcode.com/things/guide/) — definisi Area vs Project
- [What's New in the all-new Things](https://culturedcode.com/things/features/) — checklist & headings
- [Using Headings in Projects](https://culturedcode.com/things/support/articles/2803577/)
