# Spec: Logbook — arsip semua yang sudah selesai

**Tanggal:** 2026-08-08
**Status:** disetujui, siap diimplementasi
**Menutup:** `1.todo/spec.md` §6 baris "Completed"

---

## 1. Konteks

Things 3 punya **Logbook**: arsip tempat semua to-do dan project yang selesai
berakhir, tersusun kronologis menurut tanggal selesai, dan **disimpan
selamanya** sebagai catatan apa saja yang sudah dikerjakan.

`1.todo/spec.md` §6 sudah mendaftarkan view yang sama sejak awal:

| View | Isi | Urutan default |
|---|---|---|
| **Completed** | Task selesai **+ occurrence recurring §8** | `completed_at DESC`, 50/halaman |

Belum pernah dibangun.

### Yang sudah gratis

`packages/core/src/views.ts` **sudah punya** `completed()` — lengkap dengan
tesnya, urut terbaru dulu — tapi **tidak pernah diimpor satu komponen pun**.
Sama persis nasibnya dengan `search()` sebelum fitur 12.

## 2. Temuan yang menentukan bentuknya

**Task recurring tidak pernah punya `completedAt`.**

Sejak fitur recurring (#23), mencentang task berulang **tidak menutupnya** —
`due_date`-nya maju, dan `completedAt` tetap `null`. Jejaknya justru ditulis
ke tabel `completion` sebagai satu baris per kemunculan.

Artinya: Logbook yang hanya membaca `node.completedAt` akan menampilkan
**nol** riwayat untuk kebiasaan harian yang sudah dijalankan 30 kali. Justru
hal yang paling ingin dilihat orang di sebuah logbook.

Jadi Logbook harus menggabungkan dua sumber:

| Sumber | Isi |
|---|---|
| `node.completedAt !== null` | task biasa yang diselesaikan |
| baris tabel `completion` | tiap kemunculan task recurring yang diselesaikan |

Ini juga persis yang diminta §6 — *"Task selesai **+ occurrence recurring
§8**"*. Bagian setelah tanda tambah itu mudah terlewat.

## 3. Scope

**In:**
- View `/logbook` dengan nav item di sidebar
- Menggabungkan task selesai + occurrence recurring, urut terbaru dulu
- Dikelompokkan per tanggal selesai
- Halaman 50 per muat, dengan "Muat lebih banyak"

**Out (dengan alasan):**
- **Menghapus entri dari logbook.** Things menyimpannya selamanya, dan itu
  memang gunanya. Kalau perlu bersih-bersih, itu keputusan tersendiri.
- **Project selesai.** Things mencatatnya juga, tapi di sini project belum
  bisa diselesaikan sama sekali (tidak ada UI-nya). Menyusul kalau ada.
- **Membatalkan (cancel) task.** Things membedakan "selesai" dan "dibatalkan",
  keduanya masuk Logbook. Di sini belum ada konsep batal.
- **Membuka kembali task dari logbook.** Mencentang ulang bisa dilakukan dari
  view aslinya; jalur khusus dari logbook belum dibutuhkan.

## 4. Hubungannya dengan issue #30

Issue #30 (masih di Inbox) meminta **toggle tampilkan/sembunyikan task selesai
di Today/Inbox/Upcoming/Project**. Logbook **bukan** penggantinya — keduanya
menjawab kebutuhan berbeda:

| | Menjawab |
|---|---|
| Toggle #30 | *"Saya baru saja mencentang ini, biarkan terlihat tercoret"* — konteks sesaat, di tempat |
| Logbook | *"Apa saja yang sudah saya selesaikan minggu lalu?"* — riwayat, terpisah |

Things sendiri **hanya punya Logbook**, tanpa toggle per-view. Jadi #30
menyimpang dari Things — dan itu tidak apa-apa, karena diminta eksplisit.
Kalau setelah Logbook jadi ternyata #30 terasa tidak perlu lagi, #30 tinggal
ditutup; keputusan itu lebih mudah diambil setelah Logbook ada.

## 5. Keputusan desain

| Keputusan | Alasan |
|---|---|
| **Fungsi core baru `logbook()`**, bukan memperluas `completed()` | `completed()` murni menyaring node. Logbook menggabungkan dua sumber berbeda bentuk (node dan baris `completion`) jadi satu daftar. Menyatukannya bikin `completed()` melayani dua tuan. |
| **50 per halaman, "Muat lebih banyak"** | Persis §6. Logbook adalah satu-satunya view yang tumbuh tanpa batas selamanya — satu-satunya tempat di app ini yang paginasinya benar-benar berdasar, bukan jaga-jaga. |
| **Dikelompokkan per tanggal** | Mengikuti Things. Daftar datar 300 baris tidak menjawab "apa yang saya kerjakan Selasa lalu". |
| **Occurrence recurring memakai `occurredOn`, bukan `completedAt`** | `occurredOn` adalah tanggal jatuh tempo yang diselesaikan; `completedAt` jam pencatatannya. Untuk pengelompokan harian, yang bermakna adalah kapan hal itu *untuk*-nya. |

## 6. Core — `packages/core/src/logbook.ts`

```ts
import type { Node } from './node.ts'
import type { Completion } from './completion.ts'

export interface LogEntry {
  /** id node (task biasa) atau id completion (occurrence recurring) — unik lintas keduanya. */
  id: string
  node: Node
  /** ISO timestamp, dipakai untuk mengurutkan. */
  completedAt: string
  /** Terisi hanya untuk occurrence recurring — tanggal jatuh tempo yang diselesaikan. */
  occurredOn: string | null
}

/** Semua yang sudah selesai, terbaru dulu. Menggabungkan task selesai dan occurrence recurring. */
export function logbook(nodes: Node[], completions: Completion[]): LogEntry[]
```

- Task biasa: `kind==='item'`, `deletedAt===null`, `completedAt!==null`
- Occurrence: tiap baris `completion` yang node-nya masih ada dan belum terhapus
- Urut `completedAt` menurun
- Baris `completion` yang node-nya sudah terhapus **dilewati** — menampilkan
  riwayat tanpa judul tidak berguna

## 7. Success Criteria

- [ ] `/logbook` bisa dibuka dari sidebar dan langsung dari URL
- [ ] Task biasa yang diselesaikan muncul
- [ ] Tiap kemunculan task recurring yang diselesaikan muncul **terpisah**
- [ ] Task recurring yang dicentang 3 kali menghasilkan 3 baris, bukan 1
- [ ] Dikelompokkan per tanggal, terbaru di atas
- [ ] Awalnya 50 entri; "Muat lebih banyak" menambah 50
- [ ] Logbook kosong menampilkan kondisi kosong yang mengarahkan
- [ ] Entri yang node-nya sudah dihapus tidak muncul
- [ ] `npm run verify` hijau; `logbook.ts` 100% branch coverage

## Sumber

- [Things 3.5 — Logbook menampilkan tanggal selesai penuh](https://culturedcode.com/things/blog/2018/04/things-3-5/)
- [Getting Productive with Things](https://culturedcode.com/things/guide/)
