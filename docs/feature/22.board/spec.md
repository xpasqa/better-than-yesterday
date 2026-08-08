# Spec: Board — tampilan kanban per project

**Tanggal:** 2026-08-08
**Status:** disetujui, siap diimplementasi
**Menutup:** `1.todo/spec.md` §6 "Tampilan list ↔ board" · `1.todo/todo.md` blok F

---

## 1. Konteks

Permintaannya: *"kanban perlu … ambil things sebagai core dan todoist kanban
dan priority as upgrade."*

Board sempat **dibatalkan** pada 2026-08-08 karena Things tidak punya
tampilan papan. [Policy 3](../../policy/3-product-policy.md) kemudian
direvisi dengan ujian yang lebih tajam — *mengubah model, atau duduk di
atasnya?* — dan board lolos: ia tidak menambah satu pun tempat baru untuk
menyimpan sesuatu, hanya merender ulang data yang sudah ada.

Yang **tetap dibatalkan** adalah grouping/sorting yang bisa dikonfigurasi.
Konsekuensinya mengikat fitur ini: **kolom selalu section**, tidak pernah
tanggal atau prioritas, dan tidak ada menu untuk mengubahnya.

### Prioritas: sudah selesai, tidak ada di scope ini

Bagian "priority as upgrade" dari permintaan itu **sudah terpasang lengkap**
dan tidak perlu dikerjakan:

| Lapis | Bukti |
|---|---|
| Model | `node.ts:21` — `priority: 1 \| 2 \| 3 \| null` |
| Parsing | `parse.ts:273` — token `!` / `p1`–`p4` |
| Pengurutan | `views.ts:27` — Today mengurutkan menurut prioritas |
| UI | `NodeDetailModal.tsx:23` dan `AddTaskFormReal.tsx:19` |

Yang perlu berubah cuma statusnya di policy — dari "penyimpangan" jadi
"upgrade yang diterima" — dan itu sudah dilakukan.

---

## 2. Temuan yang menentukan bentuk fitur ini

**`kind='section'` ada di model, tapi nol di frontend.**
`grep -rn "'section'" apps/web/src` tidak menemukan satu pun kecocokan.

Artinya section hari ini:
- tidak bisa dibuat, di-rename, atau dihapus dari UI mana pun
- **diratakan habis** oleh `views.ts:project()`, yang memakai
  `subtreeDepthFirst` lalu menyaring `isActiveItem` — section-nya sendiri
  hilang, anak-anaknya naik jadi baris datar

Jadi board bukan "menambah satu tampilan". Ia **memperkenalkan section
sebagai konsep yang terlihat**, untuk pertama kalinya. Itu bagian terbesar
pekerjaannya, dan kenapa fitur ini dipecah empat blok, bukan satu.

---

## 3. Scope

**In:**
- `board()` di `packages/core` — mengelompokkan item project per section
- `createSection` + `deleteSection` di store (rename & pindah pakai `updateNode`)
- `BoardView` — kolom horizontal, satu per section
- Toggle **list ↔ board** di header project, tersimpan per project
- Seret kartu antar kolom → mengubah `parentId`
- **Section terlihat juga di list view** sebagai heading

**Out (dengan alasan):**

- **Board untuk daftar bawaan** (Inbox/Today/Upcoming/Anytime/Someday) —
  tidak punya section, jadi tidak punya kolom. Board hanya untuk project.
- **Kolom dari field lain** (tanggal, prioritas) — dilarang telak oleh
  [policy 3](../../policy/3-product-policy.md) §3. Ini bukan "belum", ini
  "tidak".
- **Seret untuk mengurutkan ulang di dalam kolom** — memindahkan antar kolom
  menulis `parentId`; mengurutkan di dalam kolom menulis `rank` dengan
  aritmetika sisip yang wataknya lain. Kartu jatuh ke akhir kolom, dan itu
  cukup untuk versi pertama.
- **Seret di sentuh (mobile)** — HTML5 drag tidak jalan di layar sentuh.
  Board di mobile **baca-saja**; pemindahan lewat NodeDetailModal. Ditulis di
  sini supaya tidak dilaporkan sebagai bug.
- **Section bersarang** — `1.todo/spec.md` sudah membatasi section satu
  tingkat di bawah project.

### Ketidakcocokan yang diakui di depan

**List dan board akan menampilkan jumlah task yang berbeda.**
`project()` meratakan **seluruh** keturunan, jadi subtask ikut jadi baris.
`board()` sengaja hanya mengambil **item tingkat atas** — kartu kanban berisi
subtask orang lain adalah derau, dan [fitur 14](../14.task-subtask-view/spec.md)
sudah memutuskan subtask hidup di dalam task induknya.

Jadi project dengan 8 task yang salah satunya punya 3 subtask akan
menampilkan 11 baris di list dan 8 kartu di board.

Ini **tidak diperbaiki di sini**, dan bukan karena luput: memperbaikinya
berarti mengubah `project()` — dipakai `ProjectReal` **dan** `inbox()` —
sementara [fitur 14](../14.task-subtask-view/spec.md) belum mendarat, jadi
subtask akan hilang sama sekali dari UI, bukan pindah tempat. Urutannya harus
fitur 14 dulu. Dicatat sebagai issue lanjutan, bukan diselipkan.

---

## 4. Keputusan desain

| Keputusan | Alasan |
|---|---|
| **Kolom = section, selamanya** | Policy 3 §3. Ditegakkan dengan tidak membangun jalannya sama sekali — bukan flag yang dimatikan. |
| **Kolom implisit tanpa judul di paling kiri** | Task yang belum ditaruh di section harus tetap terlihat, kalau tidak board berbohong soal isi project. Tidak punya id dan tidak bisa dihapus; menyeret ke sana berarti `parentId = projectId`. |
| **Seret menulis `parentId`** | Persis operasi yang sama dengan indent di Outline. Satu perpindahan = satu baris ditulis, dan sync/undo yang sudah ada langsung berlaku. |
| **HTML5 drag native, tanpa library** | Kebutuhannya seret-dan-jatuhkan biasa. Menambah dependensi drag untuk itu melanggar [policy 1](../1-engineering-policy.md). |
| **Pilihan list/board di `localStorage`, bukan di `node`** | Ini preferensi tampilan per perangkat, bukan data. Menaruhnya di `node` berarti migrasi, DTO sync, dan LWW — semuanya untuk sesuatu yang tidak perlu sampai ke perangkat lain. |
| **Section muncul di list view juga** | Tanpa ini, membuat section dari board membuat task seperti lenyap saat kembali ke list. Satu model, dua tampilan — keduanya harus jujur. |
| **Hapus section = soft-delete section, anaknya naik ke project** | Menghapus section tidak boleh menghapus task. Menaikkan anak ke project berarti mereka mendarat di kolom implisit — terlihat, tidak hilang. |

---

## 5. Core — `packages/core/src/board.ts`

```ts
import type { Node } from './node.ts'

export interface BoardColumn {
  /** `null` untuk kolom implisit "tanpa section". */
  section: Node | null
  items: Node[]
}

/** Kolom project, urut `rank`. Kolom implisit selalu paling depan. */
export function board(nodes: Node[], projectId: string): BoardColumn[]
```

Aturan:
- Kolom = anak langsung `projectId` dengan `kind === 'section'`,
  `deletedAt === null`, urut `rank`
- Item sebuah kolom = anak langsung section itu dengan `kind === 'item'`,
  `deletedAt === null`, `completedAt === null`, urut `rank`
- Kolom implisit = anak langsung `projectId` dengan `kind === 'item'`
  (syarat yang sama), selalu indeks 0
- **Kolom implisit ditampilkan hanya bila berisi** — papan yang selalu diawali
  satu kolom kosong adalah derau
- Project tidak ditemukan → `[]`

Item selesai **tidak ditampilkan** di board. Board adalah alat kerja
berjalan; riwayat ada di Logbook ([fitur 17](../17.logbook/spec.md)).

### 5.1 Tes

Project tanpa section (semua di kolom implisit) · beberapa section urut
`rank` · section kosong tetap muncul sebagai kolom · **kolom implisit kosong
tidak muncul** · item selesai tidak ikut · item terhapus tidak ikut · section
terhapus tidak jadi kolom **dan anaknya tidak bocor ke kolom lain** · subtask
(cucu) tidak muncul sebagai kartu · project tidak dikenal → `[]`

---

## 6. Store — `apps/web/src/store/node-actions.ts`

**Hanya dua fungsi baru**, bukan empat:

```ts
export async function createSection(projectId: string, name: string): Promise<Node>
export async function deleteSection(section: Node): Promise<void>
```

Rename dan pemindahan kartu **tidak dapat wrapper**. `updateNode(id, patch)`
yang sudah ada persis mengerjakannya:

```ts
updateNode(sectionId, { content: name })       // rename
updateNode(itemId,    { parentId: targetId })  // pindah kolom
```

Membungkusnya jadi `renameSection`/`moveItemToSection` cuma menambah nama
untuk satu baris yang sudah jelas — dilarang
[policy 1](../../policy/1-engineering-policy.md): *jangan bikin abstraksi
sebelum pemakaian ketiga*. Keduanya dipakai sekali.

`createSection` memang layak jadi fungsi: ia menghitung `rank` dari saudara
(`between(lastRank, null)`), membangun `Node` lengkap dengan lima belas
field, dan itu tidak pantas ditulis ulang di komponen.

`deleteSection` juga layak: ia menulis **dua jenis baris** dalam satu
transaksi Dexie — section di-soft-delete, dan tiap anaknya di-patch
`parentId = projectId`. Satu transaksi, karena crash di tengah akan
meninggalkan task yatim yang tidak muncul di kolom mana pun.

Keduanya lewat `enqueue()` yang sudah ada, jadi ikut `sanitizeNode` dan
outbox. **Tidak ada jalur tulis baru.**

> Section berisi 200 task menghasilkan 201 baris outbox dalam satu batch.
> Diterima — batch outbox memang dikirim sekaligus, dan menghapus section
> besar adalah tindakan yang jarang dan disengaja.

Pemindahan kartu menulis `parentId` saja; `rank` **tidak** disentuh. Kartu
mendarat menurut `rank` lamanya, yang di kolom tujuan berarti "di mana pun
ia jatuh" — konsekuensi sadar dari mencoret pengurutan-dalam-kolom di §3.

---

## 7. UI

### 7.1 `BoardView.tsx` + `BoardView.css`

- Kolom mendatar, `overflow-x: auto`; tiap kolom `overflow-y: auto`
- Header kolom: nama · jumlah · menu (rename, hapus)
- Kartu: judul, chip tanggal, titik prioritas, chip tag — **satu komponen
  `BoardCard` sendiri**, bukan `TaskRow`. `TaskRow` dibentuk untuk baris
  selebar layar; memaksanya jadi kartu 280px berarti menambah cabang props
  ke komponen yang dipakai enam view lain.
- Klik kartu → `NodeDetailModal`, sama seperti di mana pun
- Tombol "+ Add section" di ujung kanan
- Tombol "+" per kolom → `AddTaskFormReal` dengan `defaultParentId` = id
  section itu

### 7.2 Seret

HTML5 native: `draggable` di kartu, `onDragOver`/`onDrop` di kolom.
`dataTransfer` membawa id node. Jatuh di kolom yang sama → tidak ada tulisan.

Kolom yang sedang dilayangi diberi penanda visual — tanpa itu, seret di papan
sempit jadi menebak.

### 7.3 Toggle di `ProjectReal.tsx`

Dua tombol ikon di header. Pilihan disimpan
`localStorage['bty.project-view.' + projectId]`, default `list`.

### 7.4 Section di list view

`ProjectReal` merender heading section di atas kelompok task-nya. Item tanpa
section tampil lebih dulu, tanpa heading.

Ini memakai `board()` yang sama — list dan board membaca **satu sumber**,
supaya tidak mungkin berbeda isi.

> Karena itu §3 hanya menyebut selisih **jumlah**, bukan selisih isi: list
> tetap memakai `project()` untuk daftar datarnya hari ini. Blok D-lah yang
> memindahkan list ke `board()`, dan saat itulah selisih jumlah hilang
> dengan sendirinya untuk project bersection.

---

## 8. Blok kerja

| Blok | Isi | Bergantung pada |
|---|---|---|
| A | `core/board.ts` + tes | — |
| B | `createSection` + `deleteSection` di store | A |
| C | `BoardView` + kartu + seret + toggle | A, B |
| D | Heading section di list view | A |

A lebih dulu; C butuh B. D bebas setelah A.

---

## 9. Success Criteria

- [ ] Project dengan section menampilkan satu kolom per section, urut `rank`
- [ ] Task tanpa section muncul di kolom implisit paling kiri
- [ ] Kolom implisit **tidak muncul** saat tidak ada task tanpa section
- [ ] Bikin, rename, hapus section dari board
- [ ] Menghapus section **tidak menghapus task**; anaknya pindah ke kolom implisit
- [ ] Menyeret kartu antar kolom memindahkannya, dan bertahan setelah reload
- [ ] Toggle list ↔ board bertahan per project setelah reload
- [ ] List view menampilkan heading section
- [ ] Klik kartu membuka `NodeDetailModal`
- [ ] Task selesai tidak muncul di board
- [ ] Tidak ada menu grouping/sorting di mana pun — kolom selalu section
- [ ] `npm run verify` hijau; `board.ts` 100% branch coverage
