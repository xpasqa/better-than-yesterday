# Spec: Project hierarchy & appearance

**Tanggal:** 2026-08-08
**Status:** disetujui, siap diimplementasi
**Menutup:** issue #29 · melengkapi `1.todo/spec.md` §3.1 yang sudah menjanjikan project nested tapi belum pernah diimplementasi di UI

---

## 1. Konteks

Issue #29 awalnya cuma soal warna project. Setelah ditelusuri, ternyata ada
lubang yang lebih besar dan **sudah dijanjikan spec sejak awal**.

`1.todo/spec.md` §3.1 menulis:

> **`kind='project'`** melengkapi `section` dan `item`. Alasannya: project
> butuh warna, favorit, dan **boleh nested** [...]
>
> **Project tanpa batas, dan boleh nested** — Todoist mengizinkan 4 level.
> Di sini kedalaman tidak dibatasi karena pohonnya memang satu; **UI
> menampilkan hierarki di sidebar.**

Dua janji di kalimat itu — warna dan hierarki — **dua-duanya belum ada di
UI**, padahal model datanya sudah siap sejak hari pertama.

### Yang sudah gratis (tidak perlu dikerjakan)

Ini bagian yang menyenangkan: pekerjaan tersulit sudah selesai.

| Sudah ada | Di mana |
|---|---|
| Kolom `parentId` + `kind='project'` | `db/schema/node.ts`, `core/node.ts` |
| Task sub-project **sudah naik** ke view project induk | `core/views.ts` `project()` memakai `subtreeDepthFirst` |
| Badge hitungan sidebar **sudah** menghitung seluruh subtree | `Sidebar.tsx` memanggil `computeProject` yang sama |
| Deteksi siklus untuk reparent | `core/tree.ts` `wouldCreateCycle()` |

### Yang belum ada (murni UI)

| Lubang | Bukti |
|---|---|
| Project baru selalu di root | `project-actions.ts:39,79` — `parentId: null` hardcode |
| Warna project selalu kosong | `project-actions.ts:50,90` — `color: null` hardcode |
| Sidebar merender daftar datar | `Sidebar.tsx:85` — filter `kind === 'project'` tanpa menyentuh `parentId` |
| Project yang sudah ada tidak bisa diubah sama sekali | Tidak ada modal edit; `CreateProjectModal` cuma punya input nama |

Poin terakhir itu penting: tanpa modal edit, warna **cuma bisa diset saat
membuat**. Project yang sudah terlanjur ada tidak akan pernah bisa diberi
warna — yang berarti tujuan asli #29 tidak tercapai.

---

## 2. Semantik: section vs sub-project

Inilah kejelasan yang dicari. Keduanya sama-sama "mengelompokkan", tapi
menjawab pertanyaan berbeda.

| | `kind='section'` | Sub-project |
|---|---|---|
| Gunanya | Mengelompokkan task **di dalam** satu project | Project sungguhan yang kebetulan berada **di bawah** project lain |
| Punya halaman sendiri | tidak | **ya** |
| Punya warna | tidak | **ya** |
| Muncul di sidebar | tidak | **ya** |
| Punya badge hitungan | tidak | **ya** |
| Task-nya ikut terhitung di induk | — | **ya** (lewat `subtreeDepthFirst`) |

Aturan praktisnya satu kalimat:

> Kalau kelompok itu layak punya **halaman sendiri**, ia sub-project.
> Kalau cuma pemisah visual di dalam satu daftar, ia section.

Contoh: `Kerja` → `Klien A`, `Klien B` adalah sub-project (masing-masing
punya daftar tugasnya sendiri yang layak dibuka terpisah). Sedangkan
`Belanja` dengan pemisah `Mendesak` / `Nanti` cukup section.

**Catatan:** `kind='section'` saat ini **tidak dipakai satu pun UI real** —
ia hidup di skema dan spec, tapi belum pernah dirender. Jadi sub-project
adalah satu-satunya pengelompokan yang benar-benar akan dipakai orang
setelah fitur ini jalan. Section menyusul bersama Board (blok F `1.todo`).

---

## 3. Scope

**In:**
- Project bisa dibuat sebagai anak project lain
- Sidebar menampilkan hierarki dengan indentasi
- Warna project bisa dipilih saat membuat **dan** diubah setelahnya
- Project bisa di-rename dan dipindah induknya

**Out (dengan alasan):**
- **Batas kedalaman.** Spec §3.1 eksplisit "kedalaman tidak dibatasi".
  Menambah batas berarti menambah aturan + pesan error + tesnya, demi
  masalah yang belum pernah terjadi. Indentasi visual berhenti melebar
  setelah level 3 supaya layout tidak rusak — itu cukup.
- **Collapse/expand sub-project di sidebar.** Field `node.collapsed` sudah
  ada dan bisa dipakai nanti, tapi v1 tidak butuh: orang dengan 5 project
  tidak perlu melipat apa pun.
- **Drag-and-drop untuk memindah project.** Dropdown induk mengerjakan hal
  yang sama dengan pekerjaan jauh lebih sedikit.
- **Hapus project.** Belum pernah ada, dan menghapus project berisi task
  memunculkan pertanyaan sendiri (task-nya ikut terhapus? pindah ke Inbox?).
  Itu keputusan tersendiri, bukan bagian dari fitur ini.
- **Favorit project.** Field `isFavorite` ada, tapi tidak ada tempat di UI
  yang menampilkannya. Menambah toggle yang tidak berefek ke mana pun adalah
  ongkos tanpa hasil.
- **Merender `kind='section'`.** Milik Board (blok F), bukan fitur ini.

---

## 4. Keputusan desain

Filosofinya **keep it simple** — dan di sini itu berarti sebagian besar
keputusan adalah keputusan untuk *tidak* membangun sesuatu.

| Keputusan | Alasan |
|---|---|
| **Satu modal untuk create dan edit**, bukan dua komponen | Formnya identik: nama, warna, induk. Dua komponen berarti dua tempat yang harus diubah setiap kali form berubah. Satu komponen dengan mode `create`/`edit`. |
| **Dropdown induk**, bukan drag-and-drop | Hasil akhirnya sama persis (project pindah induk). DnD butuh sensor, drop indicator, dan penanganan rank — berlipat kali lebih banyak kerjaan untuk hasil yang sama. |
| **Tidak ada batas kedalaman**, indentasi visual yang dibatasi | Mengikuti spec. Batas kedalaman itu aturan yang harus ditegakkan, dijelaskan ke user, dan dites. Indentasi yang berhenti melebar menyelesaikan masalah nyatanya (layout rusak) tanpa aturan baru. |
| **Salin `COLOR_SWATCHES`, jangan diabstraksi** | `1-engineering-policy.md` §1: "Jangan bikin abstraksi sebelum pemakaian ketiga. Dua tempat yang mirip itu kebetulan." Ini pemakaian kedua (setelah `CreateLabelModal`). Ekstrak nanti kalau ada yang ketiga. |
| **Pakai `wouldCreateCycle` dari `core/tree.ts`** | Sudah ada, sudah teruji, dipakai `move()`. Menulis ulang deteksi siklus adalah pekerjaan yang sudah dibayar orang lain. |
| **Reparent tidak menyentuh `rank`** | Project dipindah ke induk baru, `rank`-nya dibiarkan. Urutan antar-saudara boleh berantakan sedikit; membenahinya butuh menghitung ulang rank dan itu bukan masalah yang dikeluhkan siapa pun. |

---

## 5. Blok kerja

### A. Store — `apps/web/src/store/project-actions.ts`

```ts
/** Membuat project. `parentId: null` = project root. */
export async function createProject(
  name: string,
  color: string,
  parentId: string | null,
  allNodes: Node[],
): Promise<string>

/** Mengubah nama, warna, dan/atau induk. Menolak diam-diam kalau memindahnya membuat siklus. */
export async function updateProject(
  id: string,
  patch: { name?: string; color?: string; parentId?: string | null },
  allNodes: Node[],
): Promise<void>
```

- `createProject` sekarang menerima `color` dan `parentId`; `rank` dihitung
  di antara saudara sekandung (`parentId` yang sama), bukan selalu di root
- `updateProject` memanggil `wouldCreateCycle(allNodes, id, parentId)` sebelum
  memindah; kalau siklus, **tidak menulis apa-apa**
- `resolveOrCreateProjectId` (jalur `#project` quick-add) tetap membuat di
  root dengan warna default — quick-add tidak punya UI untuk memilih induk,
  dan menebak induk dari teks adalah tebakan yang salahnya mahal

### B. Modal — `apps/web/src/components/ProjectModal.tsx`

Menggantikan `CreateProjectModal.tsx`.

```tsx
interface ProjectModalProps {
  mode: 'create' | 'edit'
  node?: Node          // wajib saat mode='edit'
  onClose: () => void
  onSaved?: (id: string) => void
}
```

Tiga field: **nama** (input), **warna** (swatch, pola sama seperti
`CreateLabelModal`), **induk** (dropdown, default "Tidak ada — project
utama").

Dropdown induk saat `mode='edit'` **tidak boleh memuat project itu sendiri
maupun keturunannya** — memilihnya akan membuat siklus, dan mencegahnya di
daftar pilihan lebih baik daripada menolak setelah user memilih.

### C. Sidebar — `apps/web/src/components/Sidebar.tsx`

- Bangun pohon dari `parentId`, render depth-first
- Indentasi per level, berhenti melebar setelah level 3
- Tiap baris dapat tombol **edit** (buka `ProjectModal` mode `edit`)
- Badge hitungan **tidak berubah** — `computeProject` sudah menghitung
  seluruh subtree

---

## 6. Success Criteria

- [ ] Bisa membuat project baru sebagai anak project lain
- [ ] Sidebar menampilkan hierarki dengan indentasi yang benar
- [ ] Warna bisa dipilih saat membuat project
- [ ] Warna, nama, dan induk project yang **sudah ada** bisa diubah
- [ ] Memindah project ke bawah keturunannya sendiri tidak mungkin dilakukan
      (pilihannya tidak muncul di dropdown)
- [ ] Badge hitungan project induk mencakup task dari sub-project-nya
- [ ] Membuka project induk menampilkan task sub-project-nya juga
- [ ] Project lama (`color: null`, `parentId: null`) tetap tampil normal
- [ ] `npm run verify` hijau
