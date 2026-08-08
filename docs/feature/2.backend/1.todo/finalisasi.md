# Finalisasi fitur Todo — apa yang tersisa dan urutannya

**Tanggal:** 2026-08-08
**Sumber:** board [Project 7](https://github.com/users/xpasqa/projects/7) ·
[`spec.md`](spec.md) · [`todo.md`](todo.md) · [`policy/3`](../../../policy/3-product-policy.md)

Dokumen ini bukan spec. Ia peta: **apa yang sudah berdiri, apa yang belum,
dan kenapa urutannya begitu.** Semua rincian ada di spec/plan masing-masing
fitur — di sini hanya alasan urutan dan hal-hal yang cuma kelihatan kalau
sebelas epic dilihat sekaligus.

---

## 1. Posisi sekarang

**Pondasinya sudah berdiri.** Blok A–D di [`todo.md`](todo.md) hijau semua:
core (`rank`, `tree`, `date`, `views`), skema + sync multi-entitas dengan LWW
dan cursor, store Dexie offline-first dengan outbox, dan `MainContent.tsx`
yang bukan cuma direfactor tapi **dihapus** dan diganti view-view sungguhan.

Yang tersisa duduk di atas pondasi itu — bukan menggantinya.

| | Jumlah |
|---|---|
| Epic di **Ready** | 11 |
| Epic di **Review** | 1 (#23 recurring) |
| Issue di dalam epic | 26 |
| Kartu di **Ongoing** | 0 |

Aturan 4 [workflow](../../../policy/2-workflow.md) mengunci **satu fitur di
Ongoing pada satu waktu**. Jadi ini betul-betul antrean, bukan daftar
belanja — dan urutannya menentukan berapa banyak kerja terbuang.

---

## 2. Yang mengikat urutan

Tiga ketergantungan **keras** — melanggarnya berarti kerja ulang, bukan
sekadar tidak rapi:

| Harus sesudah | Yang bergantung | Kenapa |
|---|---|---|
| #24 verifikasi manual | #23 → **Done** | Aturan 5: Done mewajibkan verifikasi benar-benar dijalankan, sehijau apa pun tesnya |
| #43 label → tag | #53 kelola tag | Halaman "kelola tag" yang dibangun di atas kata "label" harus ditulis ulang |
| #39 subtask di detail | **#63** (Board blok D) | #63 memindahkan list view ke `board()`, yang berhenti menampilkan subtask sebagai baris sendiri. Tanpa #39 subtask **hilang dari UI**, bukan pindah tempat |

Dan dua yang **bukan** ketergantungan tapi menentukan ongkos:

**#41 sebelum #43.** #41 menghapus filter tersimpan; #43 mengganti nama
`label` → `tag` di core, DB, sync, dan UI. Kalau dibalik, #43 ikut mengganti
nama di kode yang beberapa hari kemudian dihapus #41. Menghapus dulu berarti
lebih sedikit permukaan yang harus disentuh rename.

**#43 sedini mungkin.** Ongkos sebuah rename tumbuh seiring jumlah file yang
memakai nama lama. Tiap epic yang mendarat sebelum #43 menambah tempat yang
harus ikut diganti. Ini satu-satunya kartu yang benar-benar makin mahal kalau
ditunda.

### Yang bebas urutan

Dua kartu tidak bertabrakan dengan apa pun dan boleh disisipkan kapan saja:

- **#64 auto-scheduling** — seluruhnya di `packages/core/{date,parse}.ts`,
  nol perubahan UI, nol perubahan skema. Betul-betul terisolasi.
- **#31 search** — modul baru `core/search.ts` plus satu view. Satu-satunya
  sentuhan ke kode lain adalah menghidupkan tombol Search di Sidebar yang
  **selama ini mati** (`Sidebar.tsx:178`, tanpa `onClick` sama sekali).

Keduanya cocok jadi selingan kalau kartu berikutnya di antrean terasa berat.
#31 khususnya: nilai hariannya paling tinggi dengan risiko paling rendah,
jadi menariknya maju setelah #43 adalah pilihan yang sah — bukan menyerobot.

---

## 3. Urutan yang disarankan

### Gelombang 0 — tutup yang menggantung (2 kartu)

| # | Kartu | Catatan |
|---|---|---|
| 1 | **#24** → #23 ke Done | Recurring sudah lengkap dan direview, tapi **belum pernah dijalankan di browser sungguhan**. Sampai itu terjadi ia tinggal di Review |
| 2 | **#41** hapus filter tersimpan | Murni penghapusan. Mengecilkan permukaan yang harus dibaca semua kartu sesudahnya |

Mulai dari sini karena board yang punya kartu menggantung di Review membuat
"apa yang sedang dikerjakan" jadi kabur — dan karena keduanya murah.

### Gelombang 1 — penamaan (1 kartu)

| # | Kartu | Catatan |
|---|---|---|
| 3 | **#43** label → tag | Core + DB + sync + UI. Makin ditunda makin mahal |

Sendirian di gelombangnya sendiri karena ia menyentuh empat lapis sekaligus;
menumpuknya dengan kartu lain membuat diff-nya tidak bisa dibaca.

### Gelombang 2 — struktur ala Things (2 kartu, 2 migrasi)

| # | Kartu | Catatan |
|---|---|---|
| 4 | **#29** Area → Project | Migrasi `kind='area'` — enum, CHECK, tipe core, DTO sync |
| 5 | **#50** Anytime & Someday | Kolom `isSomeday`. Melengkapi lima daftar bawaan |

Ini inti model Things dan pondasi buat semua yang sesudahnya. Setelah
gelombang ini, **lima daftar bawaan lengkap**: Inbox, Today, Upcoming,
Anytime, Someday.

> ### ⚠️ Satu migrasi pada satu waktu, diverifikasi sebelum lanjut
>
> Dua bug paling berbahaya sepanjang epic recurring **keduanya sekelas**:
> baris yang melanggar CHECK di DB → 500 saat sync → dan karena outbox
> didorong sebagai **satu batch**, seluruh sync macet permanen — bukan cuma
> baris itu.
>
> #29 menambah nilai enum dan menyentuh CHECK. Itu persis kelas risiko yang
> sama. Jangan tumpuk dua migrasi dalam satu putaran, dan verifikasi sync
> benar-benar jalan sebelum menumpuk kartu berikutnya di atasnya.
>
> Bug itu lolos dari **sembilan review per-task** dan baru tertangkap review
> menyeluruh di akhir. Review per-task tidak melihatnya karena tiap task
> benar sendiri-sendiri.

### Gelombang 3 — isi task & riwayat (3 kartu)

| # | Kartu | Catatan |
|---|---|---|
| 6 | **#39** subtask di task detail | Nol perubahan model — murni rendering. Membuka jalan #63 |
| 7 | **#30** toggle tampilkan/sembunyikan selesai | Parameter `includeCompleted` di `views.ts` |
| 8 | **#47** Logbook | Menggabung dua sumber — lihat §5 |

### Gelombang 4 — upgrade dari Todoist (4 kartu)

| # | Kartu | Catatan |
|---|---|---|
| 9 | **#64** auto-scheduling | Terisolasi; boleh disisipkan lebih awal |
| 10 | **#65** Board | Blok D (#63) sudah aman karena #39 lewat di gelombang 3 |
| 11 | **#53** kelola tag | Butuh #43 |
| 12 | **#31** search | Boleh ditarik maju kapan saja setelah #43 |

Ditaruh terakhir bukan karena kurang penting, tapi karena
[policy 3](../../../policy/3-product-policy.md) menempatkannya sebagai
tambahan **di atas** struktur — dan strukturnya baru selesai di gelombang 2.

---

## 4. Yang belum punya kartu sama sekali

Ini bagian yang paling gampang terlewat: board berisi sebelas epic, tapi
[`todo.md`](todo.md) masih menyimpan pekerjaan yang **tidak diwakili kartu
mana pun**. Menyelesaikan dua belas kartu di §3 **tidak** menyelesaikan fase
1.

| Blok | Yang tersisa | Ukuran |
|---|---|---|
| **I** | **Reminder & notifikasi web push** — tabel `reminder`/`notification`/`push_subscription` sudah ada di skema, **nol kode** | besar — butuh service worker, VAPID, penjadwal |
| **J** | Halaman Settings — timezone user masih hardcode `'Asia/Jakarta'` di enam pemanggilan | sedang |
| **J** | Keyboard shortcut (`q`/`a` buka quick add, `⌘Z` undo) | sedang |
| **J** | E2E Playwright — runner belum terpasang sama sekali | sedang |
| **E** | Penyorotan `spans` di dalam input quick-add — **data sudah ada dari parser**, tinggal dirender | kecil |
| **F** | Drag reorder lintas section/project (Today belum punya drag) | sedang |
| **H** | Indikator recurring di meta row `TaskRow` — sengaja di luar scope #23 | kecil |

**Reminder & notifikasi (blok I) adalah lubang terbesar** — ia disebut di
judul spec induk sebagai bagian dari paritas, skemanya sudah dibuat, dan
belum ada satu baris kode pun. Ia juga satu-satunya sisa yang butuh
infrastruktur baru (service worker, kunci VAPID, penjadwal sisi server),
bukan sekadar kode aplikasi.

Tiga yang **kecil** (`spans` highlight, indikator recurring) menarik karena
datanya sudah tersedia — parser sudah mengembalikan `spans`, node sudah punya
`recurrence`. Yang kurang cuma perenderannya. Kandidat bagus untuk disisipkan
di sela gelombang.

Semuanya masih di [`todo.md`](todo.md), **belum di board** — sesuai aturan:
kartu baru masuk lewat Inbox setelah ada spec, bukan langsung.

---

## 5. Hal-hal yang cuma kelihatan dari atas

Empat temuan yang tidak muncul kalau tiap epic dibaca sendiri-sendiri.

**Logbook harus menggabung dua sumber, bukan satu.** Task berulang **tidak
pernah** mendapat `completedAt` — menyelesaikannya memajukan `dueDate` dan
menulis satu baris ke tabel `completion`. Jadi Logbook yang cuma membaca
`completedAt IS NOT NULL` akan **kehilangan seluruh riwayat task berulang**,
yang justru yang paling sering diselesaikan. Sudah tertangkap di
[spec 17](../../17.logbook/spec.md); ditulis lagi di sini karena ini jenis
kesalahan yang lolos sampai produksi.

**`dueDate` di app ini berperilaku seperti *start date* Things, bukan
deadline.** Task muncul di Today pada `dueDate`-nya dan tinggal di sana.
Perbedaan ini tidak pernah dibuat eksplisit di UI. Bukan bug, tapi akan jadi
sumber kebingungan begitu Upcoming dan Someday berdiri berdampingan — dan
kalau nanti mau menambahkan deadline sungguhan, itu **field baru**, bukan
penafsiran ulang field yang ada.

**`kind='section'` ada di model tapi nol di frontend.**
`grep -rn "'section'" apps/web/src` → tidak ada kecocokan. Section tidak bisa
dibuat dari UI mana pun, dan `views.ts:project()` meratakannya habis. Karena
itu #65 dipecah empat blok: ia memperkenalkan section sebagai konsep yang
**terlihat**, untuk pertama kalinya — bukan sekadar menambah satu tampilan.

**Prioritas sudah selesai.** Model (`node.ts:21`), parser (`parse.ts:273`),
pengurutan Today (`views.ts:27`), UI di `NodeDetailModal` dan
`AddTaskFormReal`. Tidak ada kartu untuknya karena tidak ada yang perlu
dibangun — yang berubah cuma statusnya di
[policy 3](../../../policy/3-product-policy.md), dari "penyimpangan sah" jadi
"upgrade yang diterima".

---

## 6. Batas yang tidak boleh dilanggar sambil jalan

Dari [policy 3](../../../policy/3-product-policy.md). Ditulis ulang di sini
karena keduanya paling gampang tergelincir justru saat sedang menyenangkan
diri sendiri di tengah implementasi:

- **Kolom board selalu section.** Tidak pernah tanggal, prioritas, atau
  label. Jangan bangun jalannya — ini bukan flag yang dimatikan.
- **Tidak ada menu grouping/sorting per view.** Lima daftar bawaan plus
  Area → Project mengerjakan tugas yang sama tanpa satu pun menu. Ini poros
  perbedaan Things dan Todoist, dan di sini Things yang menang.

Ujiannya, kalau ragu: *apakah ini menambah tempat baru untuk menyimpan atau
menata sesuatu?* Kalau ya — tunduk pada model Things, atau tidak dibangun.

---

## 7. Fase 1 selesai bila

- [ ] Dua belas kartu di §3 semuanya **Done** — dengan verifikasi
      benar-benar dijalankan, bukan cuma tes hijau (aturan 5)
- [ ] Lima daftar bawaan lengkap dan benar: Inbox, Today, Upcoming, Anytime,
      Someday
- [ ] Logbook memuat riwayat task biasa **dan** task berulang
- [ ] Blok I (reminder & notifikasi) punya spec — atau dinyatakan keluar dari
      fase 1 secara tertulis, bukan didiamkan
- [ ] Sisa blok E/F/H/J di §4 punya kartu atau keputusan tertulis
- [ ] `npm run verify` hijau; `packages/core` tetap tanpa I/O

Yang **tidak** jadi syarat: paritas fitur dengan Todoist. Itu bukan lagi
tujuannya sejak [policy 3](../../../policy/3-product-policy.md) — judul spec
induk ("Paritas Todoist") sekarang menyebut sasaran yang sudah ditinggalkan,
dan sebaiknya diperbaiki saat ada yang menyentuh file itu lagi.
