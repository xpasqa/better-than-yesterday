# Spec: Search — pencarian task berdasarkan keyword

**Tanggal:** 2026-08-08
**Status:** disetujui, siap diimplementasi
**Menutup:** `1.todo/spec.md` §6 baris "Search" · sebagian `1.todo/todo.md` blok G

---

## 1. Konteks

`1.todo/spec.md` §6 sudah mendaftarkan view **Search** ("Judul & catatan,
case-insensitive", urut "relevansi lalu tanggal") sejak awal, tapi belum
pernah diimplementasi. Jejaknya di kode hari ini:

- `packages/core/src/views.ts` punya `today`/`upcoming`/`project`/`inbox`/
  `completed` — **tidak ada `search`**. Header filenya sendiri mencatat
  "Not yet implemented: label view, saved-filter query language, search".
- `apps/web/src/components/Sidebar.tsx:178` punya tombol "Search" lengkap
  dengan ikon — **tanpa `onClick` sama sekali**, tombol mati.
- `ViewType` (`apps/web/src/types/index.ts`) tidak punya varian `'search'`.

`1.todo/todo.md` blok G membundel "Filter tersimpan & pencarian" jadi satu
item. Spec ini **sengaja memecahnya**: hanya mengerjakan search, tanpa
menyentuh bahasa query filter tersimpan (§7).

> **Diperbarui 2026-08-08:** filter tersimpan kemudian **dihapus seluruhnya**
> (fitur 15). Pemisahan search dari blok G tetap benar; yang berubah cuma
> alasannya — blok G sekarang tinggal search saja.

---

## 2. Scope

**In:**
- Modul murni `packages/core/src/search.ts` — pencocokan teks + ranking
- View `/search` dengan input dan daftar hasil
- Menghidupkan tombol Search di Sidebar yang selama ini mati
- Task **aktif dan selesai** ikut tercari; yang selesai tampil tercoret

**Out (dengan alasan):**
- ~~**Bahasa query filter tersimpan (§7)**~~ — **dihapus seluruhnya** oleh
  fitur 15. Tidak ada lagi yang perlu disiapkan untuknya.
- **Highlight teks yang cocok di hasil** — polish yang tidak menghalangi
  fitur berfungsi; lihat issue polish terpisah.
- **Keyboard shortcut untuk membuka search** (`⌘K` / `/`) — app ini belum
  punya satupun keyboard shortcut (`1.todo/todo.md` blok J), jadi ini bagian
  dari pekerjaan shortcut menyeluruh, bukan milik search.
- **Search di dalam Outline** — `2.outline/spec.md` §I sudah punya rencana
  sendiri yang berbeda wataknya (sorot kecocokan *di tempat*, buka induk yang
  menutupi), bukan daftar hasil datar.
- **Fuzzy / toleransi typo** — butuh algoritma scoring sendiri, ranking jadi
  jauh lebih sulit dijelaskan dan diuji.
- **Pencarian project & section** — hasil sengaja dijaga homogen (semua
  `kind='item'`) supaya bisa memakai `TaskRow` apa adanya.

---

## 3. Keputusan desain

| Keputusan | Alasan |
|---|---|
| **Modul sendiri `core/search.ts`**, bukan menambah ke `views.ts` | `views.ts` isinya filter pohon & tanggal; search wataknya beda — tokenisasi teks dan ranking relevansi.<br><br>**Catatan kejujuran:** alasan utama semula adalah "`core/filter.ts` kelak mengimpor matcher ini". Filter tersimpan sudah dihapus (fitur 15), jadi argumen itu **gugur**. Keputusannya tetap dipertahankan atas alasan yang tersisa — pemisahan watak — yang memang lebih lemah tapi masih berdiri sendiri. |
| **Multi-kata, semua harus ada, urutan bebas** | "susu beli" tetap menemukan "beli susu di pasar". Cuma sedikit lebih rumit dari substring polos, tapi jauh lebih sesuai cara orang mengingat isi task. |
| **Task selesai ikut muncul** | Orang sering mencari task justru karena ingat pernah mengerjakannya. Pembedanya visual (tercoret), bukan disembunyikan. Konsisten dengan arah issue #30. |
| **Halaman `/search` sendiri**, bukan overlay `⌘K` | Persis pola view yang sudah ada (`routes.ts` → `ViewType` → cabang di `App.tsx`), jadi paling murah dan konsisten. Dapat URL sendiri yang bisa di-bookmark — `2.outline/spec.md` §8 menjadikan "tiap view punya alamat sungguhan" sebagai prinsip. Overlay tanpa `⌘K` kehilangan sebagian besar nilainya, dan shortcut belum ada. |
| **Query kosong → hasil kosong**, bukan semua task | Halaman search yang membuang seluruh isi database saat dibuka adalah derau, bukan fitur. Kondisi kosong dipakai untuk mengarahkan ("Ketik untuk mencari"). |
| **Tanpa debounce** | Pencocokan sinkron di memori atas data Dexie yang sudah ter-load. Tidak ada jaringan di jalur render (spec induk §3.2), jadi tidak ada yang perlu di-debounce. |

---

## 4. Core — `packages/core/src/search.ts`

Fungsi murni, tanpa I/O, seperti seluruh isi `packages/core`.

```ts
import type { Node } from './node.ts'

/**
 * Pecah query jadi token lowercase. Query kosong/spasi saja → array kosong,
 * yang oleh `search()` diartikan "jangan tampilkan apa-apa".
 */
export function tokenize(query: string): string[]

/**
 * Apakah `node` cocok dengan seluruh `tokens`? Setiap token harus ada di
 * judul ATAU catatan (urutan bebas). Dipakai `search()`, dan nanti oleh
 * pemanggil lain di kemudian hari, tanpa ikut membawa logika ranking.
 */
export function matches(node: Node, tokens: string[]): boolean

/** Task yang cocok, terurut relevansi lalu tanggal. */
export function search(nodes: Node[], query: string): Node[]
```

### 4.1 Kandidat

`kind === 'item'` && `deletedAt === null`.

**`completedAt` tidak difilter** — inilah satu-satunya tempat di seluruh
`packages/core` yang sengaja tidak memakai pola `isActiveItem()` milik
`views.ts`, dan alasannya harus jelas di komentar kode supaya tidak
"diperbaiki" orang lain di kemudian hari.

### 4.2 Pencocokan

Haystack = `content` + `"\n"` + (`note` ?? `""`), di-lowercase sekali per node.
Cocok bila **setiap** token muncul sebagai substring di haystack itu.

### 4.3 Ranking

Spec §6 meminta "relevansi lalu tanggal". Relevansi didefinisikan konkret
sebagai berapa banyak token yang kena di **judul** (judul lebih menandakan
maksud daripada catatan):

| Kondisi | Skor |
|---|---|
| Semua token ada di judul | 0 |
| Sebagian di judul, sisanya di catatan | 1 |
| Tidak ada satupun di judul (semua hanya di catatan) | 2 |

Tiebreak berurutan: `dueDate` menaik (**tanpa tanggal terakhir**, memakai
sentinel `'9999-99-99'` mengikuti pola `byTodayOrder` di `views.ts` yang
sudah memakai `'99:99'` untuk `dueTime`), lalu `rank`.

Task selesai **tidak** diturunkan skornya — kalau cocok, ya cocok. Yang
membedakan adalah tampilan tercoret, bukan urutan.

### 4.4 Tes

Wajib, dengan tabel input→output seperti modul core lain:

- Query kosong dan whitespace-saja → `[]`
- Satu token cocok di judul; cocok di catatan; tidak cocok sama sekali
- Multi-token urutan terbalik tetap cocok
- Multi-token dengan satu token tidak ada → tidak cocok
- Case-insensitive dua arah (query huruf besar vs isi huruf besar)
- Task selesai ikut muncul di hasil
- Task terhapus (`deletedAt`) tidak pernah muncul
- `kind='project'`/`'section'` tidak pernah muncul
- Node dengan `note: null` tidak melempar error
- Urutan: tiga skor terurut benar; tiebreak tanggal; tanpa tanggal di akhir

---

## 5. UI — `apps/web/src/components/SearchView.tsx`

Mengikuti bentuk `TodayReal.tsx`/`InboxReal.tsx` (`RealView.css`, `TaskRow`,
`SyncStatusBadge`).

```tsx
interface SearchViewProps {
  user: AuthUser
  onOpenNode?: (id: string) => void
}
```

- `useState` lokal untuk query; `useAllNodes()` + `useAllLabels()` seperti
  view lain
- `search(nodes, query)` dipanggil langsung saat render (sinkron, di memori)
- Input auto-focus saat view dibuka — orang membuka Search untuk mengetik
- Tiap hasil dirender `<TaskRow>` dengan **`allNodes` diteruskan**, supaya
  nama project induk ikut tampil. Di hasil search konteks project jauh lebih
  penting daripada di view lain, dan `TaskRow` sudah mendukungnya gratis.
- `timezone={user.timezone ?? 'Asia/Jakarta'}` — wajib sejak issue #26

### 5.1 Tiga kondisi tampilan

| Kondisi | Tampilan |
|---|---|
| Query kosong | "Ketik untuk mencari task" — mengarahkan, bukan halaman kosong |
| Ada query, nol hasil | "Tidak ada task yang cocok dengan \<query\>" |
| Ada hasil | Header jumlah ("N hasil") lalu daftar `TaskRow` |

---

## 6. Routing & Sidebar

- `apps/web/src/types/index.ts` — tambah `'search'` ke `ViewType`
- `apps/web/src/routes.ts` — tambah `'search'` ke `PLAIN_VIEWS`
- `apps/web/src/App.tsx` — cabang baru sebelum fallback `null`
- `apps/web/src/components/Sidebar.tsx:178` — tombol yang mati diberi
  `onClick={() => onViewChange('search')}` dan kelas `--active` seperti nav
  item lainnya

---

## 7. Success Criteria

- [ ] Mengetik keyword menampilkan task yang cocok di judul maupun catatan
- [ ] Urutan kata di query tidak memengaruhi hasil
- [ ] Case-insensitive
- [ ] Task selesai muncul, tercoret
- [ ] Tiap hasil menampilkan nama project induknya
- [ ] Klik hasil membuka `NodeDetailModal`; centang menyelesaikan task
- [ ] Tombol Search di Sidebar berfungsi dan menyala saat aktif
- [ ] `/search` bisa dibuka langsung dari URL
- [ ] Tiga kondisi tampilan (kosong / nol hasil / ada hasil) benar
- [ ] `npm run verify` hijau; `search.ts` 100% branch coverage
