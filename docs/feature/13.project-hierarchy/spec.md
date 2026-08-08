# Spec: Project hierarchy & appearance

**Tanggal:** 2026-08-08
**Status:** disetujui, siap diimplementasi
**Menutup:** issue #29
**Merevisi:** `1.todo/spec.md` §3.1 (kedalaman nested — lihat §4.1)

---

## 1. Konteks

Issue #29 awalnya cuma soal warna project. Penelusuran menemukan lubang yang
lebih besar, dan **sudah dijanjikan spec sejak awal**. `1.todo/spec.md` §3.1:

> **`kind='project'`** [...] project butuh warna, favorit, dan **boleh
> nested** [...] **UI menampilkan hierarki di sidebar.**

Tiga janji di kalimat itu — **warna, favorit, hierarki** — ketiganya belum
ada di UI, padahal model datanya (`color`, `isFavorite`, `parentId`) sudah
siap sejak hari pertama.

### Yang sudah gratis

Bagian tersulit ternyata sudah selesai:

| Sudah ada | Di mana |
|---|---|
| Kolom `parentId`, `color`, `isFavorite` | `db/schema/node.ts`, `core/node.ts` |
| Task sub-project **sudah naik** ke view induk | `core/views.ts` `project()` → `subtreeDepthFirst` |
| Badge sidebar **sudah** menghitung seluruh subtree | `Sidebar.tsx` → `computeProject` |
| Soft-delete | Kolom `deletedAt` + semua view sudah menyaringnya |

### Yang belum ada — murni UI

| Lubang | Bukti |
|---|---|
| Project baru selalu di root | `project-actions.ts:39,79` — `parentId: null` hardcode |
| Warna selalu kosong | `project-actions.ts:50,90` — `color: null` hardcode |
| Favorit tidak pernah bisa diset | `isFavorite: false` hardcode, tanpa UI |
| Sidebar merender daftar datar | `Sidebar.tsx:85` — filter tanpa menyentuh `parentId` |
| Project tidak bisa diubah maupun dihapus | Tidak ada modal edit sama sekali |

Poin terakhir yang paling menentukan: tanpa modal edit, warna **cuma bisa
diset saat membuat**. Project yang sudah terlanjur ada tidak akan pernah
bisa diberi warna — tujuan asli #29 tidak tercapai.

---

## 2. Riset: bagaimana Todoist menanganinya

Diverifikasi dari dokumentasi resmi, bukan ingatan:

| Aspek | Todoist |
|---|---|
| Kedalaman sub-project | **3 level indent**, hanya untuk personal project |
| Kedalaman sub-task | 4 level — **angka yang berbeda**, sering tertukar |
| Cara membuat sub-project | **Drag-and-drop** — geser kiri/kanan untuk mengubah indent |
| Kalau melewati batas indent | Todoist menyarankan pakai **section** sebagai gantinya |
| Favorit | Ditandai saat membuat atau sesudahnya; muncul di sidebar |
| Hapus vs arsip | Arsip bisa dipulihkan; hapus permanen (pulih hanya lewat backup di paket berbayar) |
| Project ter-share | Ditawari **"leave"**, bukan hapus |

Dokumentasi Todoist **tidak menyebutkan** apa yang terjadi pada task dan
sub-project saat induknya dihapus. Jadi bagian itu keputusan kita sendiri
(§4.3), bukan mencontoh.

**Koreksi ke spec lama:** `1.todo/spec.md` §3.1 menulis *"Todoist
mengizinkan 4 level"* untuk project — itu keliru, 4 adalah angka sub-task.
Untuk project Todoist mengizinkan 3. Sudah dicoret di spec itu.

---

## 3. Scope

**In:**
- Project bisa dibuat sebagai anak project lain, **satu tingkat saja**
- Sidebar menampilkan hierarki dua tingkat
- Warna dipilih saat membuat **dan** bisa diubah setelahnya
- Project bisa di-rename, dipindah induknya, **difavoritkan**, dan **dihapus**
- Section "Favorites" di sidebar

**Out (dengan alasan):**
- **Drag-and-drop untuk memindah project.** Todoist memakai ini, kita tidak:
  dropdown induk menghasilkan hal yang sama persis dengan pekerjaan berlipat
  kali lebih sedikit (sensor, drop indicator, penghitungan rank). Kalau nanti
  terasa kurang, DnD bisa ditambahkan di atas store yang sama.
- **Arsip project.** Todoist punya arsip *dan* hapus. Kita cuma perlu hapus
  dulu — arsip adalah kolom baru + view baru + jalur pemulihan, demi kasus
  yang belum pernah muncul.
- **Restore project terhapus.** Datanya aman (soft-delete, `deletedAt`), jadi
  bisa ditambahkan kapan pun tanpa migrasi. Tapi UI-nya belum dibutuhkan.
- **Merender `kind='section'`.** Milik Board (blok F `1.todo`).

---

## 4. Keputusan desain

### 4.1 Kedalaman: satu tingkat sub saja

`1.todo/spec.md` §3.1 semula menulis "kedalaman tidak dibatasi". **Direvisi:**
project boleh punya sub-project, tapi **sub-project tidak boleh punya anak**.
Maksimal dua tingkat.

Ini lebih ketat dari Todoist (3 tingkat), dan itu disengaja:

- **Dua tingkat sudah menjawab kebutuhan semantiknya** — `Kerja` → `Klien A`.
  Tingkat ketiga jarang dipakai, dan Todoist sendiri menyarankan pindah ke
  section begitu batasnya kena.
- **Yang paling menentukan: siklus jadi mustahil secara struktural.** Kalau
  induk hanya boleh project root, dan project yang punya anak tidak boleh
  dipindah, maka A→B→A tidak bisa terjadi. Itu menghapus seluruh kelas kode:
  tidak perlu `wouldCreateCycle`, tidak perlu tesnya, tidak perlu pesan
  errornya. Aturan yang lebih ketat justru **menghapus** kode, bukan menambah.
- **Indentasi sidebar jadi sepele** — dua tingkat, tidak perlu logika
  pembatas lebar.

Invarian yang ditegakkan `updateProject`, bukan cuma UI:

> Sebuah project boleh punya `parentId` **hanya jika** calon induknya adalah
> project root (`parentId === null`), **dan** project itu sendiri tidak punya
> anak.

### 4.2 Satu modal untuk create, edit, dan hapus

Formnya identik: nama, warna, induk, favorit. Dua komponen berarti dua tempat
yang harus diubah tiap kali form berubah. Tombol Hapus ikut di sini pada mode
`edit` — user sudah berada di tempat yang benar, tidak perlu menu terpisah.

### 4.3 Hapus = soft-delete project beserta seluruh isinya

Yang paling perlu dipikirkan, karena dokumentasi Todoist tidak menjawabnya.

Pilihannya tiga: hapus semuanya, pindahkan task ke Inbox, atau tolak menghapus
project yang tidak kosong. **Dipilih: hapus semuanya** — memindahkan 40 task
ke Inbox tanpa diminta adalah kejutan yang lebih buruk daripada menghapus,
dan menolak menghapus membuat project mati tidak bisa dibersihkan.

Karena `deletedAt` sudah soft-delete, "hapus" berarti menandai project **dan
seluruh keturunannya** (sub-project, section, task). Datanya tetap ada di
Postgres; yang hilang cuma dari tampilan.

**Konfirmasi wajib menyebut angka sebenarnya** — "Hapus *Kerja*? 12 task dan
2 sub-project ikut terhapus." Dialog yang cuma bertanya "yakin?" tidak
memberi informasi apa pun untuk memutuskan.

### 4.4 Favorit muncul di section sendiri

`isFavorite` sudah ada di skema tapi tidak pernah punya tempat. Ditambahkan:
section **Favorites** di atas "My Projects" di sidebar.

Project favorit **tetap muncul juga** di My Projects — sama seperti Todoist.
Menghilangkannya dari daftar utama berarti menambah kasus khusus, dan membuat
orang bingung mencari project yang "hilang".

### 4.5 Yang tetap disalin, bukan diabstraksi

`COLOR_SWATCHES` disalin dari `CreateLabelModal.tsx`. `1-engineering-policy.md`
§1: *"Jangan bikin abstraksi sebelum pemakaian ketiga. Dua tempat yang mirip
itu kebetulan."* Ini pemakaian kedua.

---

## 5. Blok kerja

### A. Store — `apps/web/src/store/project-actions.ts`

```ts
export async function createProject(
  name: string, color: string, parentId: string | null, allNodes: Node[],
): Promise<string>

export async function updateProject(
  id: string,
  patch: { name?: string; color?: string; parentId?: string | null; isFavorite?: boolean },
  allNodes: Node[],
): Promise<void>

/** Soft-delete project + seluruh keturunannya. */
export async function deleteProject(id: string, allNodes: Node[]): Promise<void>

/** Berapa yang akan ikut terhapus — untuk dialog konfirmasi. */
export function countDescendants(id: string, allNodes: Node[]): { tasks: number; subProjects: number }
```

- `rank` dihitung di antara **saudara sekandung**, bukan selalu di root
- `updateProject` menegakkan invarian §4.1; kalau dilanggar → tidak menulis apa pun
- `deleteProject` menulis `deletedAt` ke project dan seluruh keturunannya
  dalam **satu transaksi Dexie**, masing-masing masuk outbox
- `resolveOrCreateProjectId` (quick-add `#project`) tetap root + warna default

### B. Modal — `apps/web/src/components/ProjectModal.tsx`

Menggantikan `CreateProjectModal.tsx`.

Field: **nama**, **warna** (swatch), **induk** (dropdown, hanya project root,
kecuali diri sendiri), **favorit** (checkbox).

Mode `edit` menambah tombol **Hapus** dengan konfirmasi yang menyebut angka
dari `countDescendants`.

Dropdown induk **dinonaktifkan** kalau project ini punya anak, dengan
keterangan singkat kenapa — mencegah lebih baik daripada menolak setelah
dipilih.

### C. Sidebar — `apps/web/src/components/Sidebar.tsx`

- Section **Favorites** di atas My Projects
- My Projects merender dua tingkat: root lalu anak-anaknya, indentasi satu langkah
- Tiap baris punya aksi edit → `ProjectModal` mode `edit`
- Badge hitungan **tidak disentuh** — sudah subtree-wide

---

## 6. Success Criteria

- [ ] Bisa membuat project baru sebagai anak project root
- [ ] Sub-project **tidak bisa** diberi anak lagi (tidak muncul sebagai pilihan induk)
- [ ] Project yang punya anak tidak bisa dipindah jadi sub-project
- [ ] Sidebar menampilkan dua tingkat dengan indentasi benar
- [ ] Warna dipilih saat membuat, dan bisa diubah di project yang sudah ada
- [ ] Favorit bisa di-toggle; project favorit muncul di section Favorites **dan** My Projects
- [ ] Hapus project menghapus seluruh task dan sub-project di bawahnya
- [ ] Dialog konfirmasi menyebut jumlah task dan sub-project yang ikut terhapus
- [ ] Badge hitungan induk mencakup task sub-project-nya
- [ ] Project lama (`color: null`, `parentId: null`) tetap tampil normal
- [ ] `npm run verify` hijau

---

## Sumber

- [Introduction to Todoist projects](https://www.todoist.com/help/articles/introduction-to-todoist-projects-TLTjNftLM)
- [Create a sub-project in Todoist](https://www.todoist.com/help/articles/create-a-sub-project-in-todoist-aTA15C70)
- [Introduction to sub-tasks](https://www.todoist.com/help/articles/introduction-to-sub-tasks-kMamDo)
