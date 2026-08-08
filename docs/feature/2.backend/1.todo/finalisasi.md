# Finalisasi fitur Todo — apa yang tersisa dan urutannya

**Tanggal:** 2026-08-08
**Sumber:** board [Project 7](https://github.com/users/xpasqa/projects/7) ·
[`spec.md`](spec.md) · [`todo.md`](todo.md) · [`policy/3`](../../../policy/3-product-policy.md)

> **Versi yang bisa dieksekusi ada di [#83](https://github.com/xpasqa/better-than-yesterday/issues/83)** — urutan yang
> sama, tapi ditulis untuk diserahkan ke agen lain tanpa konteks percakapan.
> Kalau keduanya berbeda, **#83 yang menang** dan dokumen ini yang harus
> menyusul.

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
| Epic di **Ready** | 15 |
| Epic di **Review** | 1 (#23 recurring) |
| Issue di dalam epic | 34 |
| Kartu di **Backlog** | 3 |
| Kartu di **Inbox** | 2 |
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

Enam belas kartu, satu per satu (aturan 4: satu fitur di Ongoing pada satu
waktu). Alasan tiap penempatan dan jebakannya ada di [#83](https://github.com/xpasqa/better-than-yesterday/issues/83).

| Gel. | Urutan | Kartu | Kenapa di situ |
|---|---|---|---|
| **0** | 1 | [#80](https://github.com/xpasqa/better-than-yesterday/issues/80) E2E Playwright | Blok B **menutup #24** → #23 akhirnya bisa ke Done. Sekaligus jaring pengaman untuk #43 |
| | 2 | [#75](https://github.com/xpasqa/better-than-yesterday/issues/75) bug anchor recurrence | Merusak task berulang **diam-diam** |
| | 3 | [#77](https://github.com/xpasqa/better-than-yesterday/issues/77) metadata terurai | Kecil, nol perubahan model. Membuat recurring **terlihat** — berguna justru saat memverifikasi #23 |
| | 4 | [#41](https://github.com/xpasqa/better-than-yesterday/issues/41) hapus filter tersimpan | Murni penghapusan; mengecilkan permukaan semua kartu sesudahnya |
| **1** | 5 | [#43](https://github.com/xpasqa/better-than-yesterday/issues/43) label → tag | Sendirian — empat lapis sekaligus. Makin ditunda makin mahal |
| **2** | 6 | [#29](https://github.com/xpasqa/better-than-yesterday/issues/29) Area → Project | **Migrasi enum + CHECK.** Baca peringatan di bawah |
| | 7 | [#50](https://github.com/xpasqa/better-than-yesterday/issues/50) Anytime & Someday | Melengkapi lima daftar bawaan |
| **3** | 8 | [#39](https://github.com/xpasqa/better-than-yesterday/issues/39) subtask di detail | Nol perubahan model. **Membuka jalan #65 blok D** |
| | 9 | [#30](https://github.com/xpasqa/better-than-yesterday/issues/30) toggle selesai | |
| | 10 | [#47](https://github.com/xpasqa/better-than-yesterday/issues/47) Logbook | Menggabung dua sumber |
| **4** | 11 | [#31](https://github.com/xpasqa/better-than-yesterday/issues/31) Search | Menghidupkan tombol Sidebar yang selama ini mati |
| | 12 | [#79](https://github.com/xpasqa/better-than-yesterday/issues/79) keyboard shortcut | Butuh #31 untuk `/` |
| | 13 | [#64](https://github.com/xpasqa/better-than-yesterday/issues/64) auto-scheduling | Terisolasi penuh |
| | 14 | [#65](https://github.com/xpasqa/better-than-yesterday/issues/65) Board | Blok D aman karena #39 sudah lewat |
| | 15 | [#53](https://github.com/xpasqa/better-than-yesterday/issues/53) kelola tag | Butuh #43 |
| | 16 | [#78](https://github.com/xpasqa/better-than-yesterday/issues/78) Settings | Terisolasi penuh |

**Menunggu:** [#81](https://github.com/xpasqa/better-than-yesterday/issues/81) drag reorder (setelah #65 blok C) ·
[#82](https://github.com/xpasqa/better-than-yesterday/issues/82) reminder (setelah keputusan penjadwal) ·
[#74](https://github.com/xpasqa/better-than-yesterday/issues/74), [#76](https://github.com/xpasqa/better-than-yesterday/issues/76) di Inbox.

**Boleh disisipkan kapan saja:** #64 dan #78 — nol konflik dengan apa pun.
#31 juga boleh ditarik maju setelah #43; nilai hariannya paling tinggi dengan
risiko paling rendah.

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
> menyeluruh di akhir — tiap task benar sendiri-sendiri; yang salah
> gabungannya.

---

## 4. Sisa yang sekarang sudah berkartu

Bagian ini semula berjudul *"yang belum punya kartu sama sekali"*. Semuanya
sudah ditelusuri ke kode dan dibuatkan kartu — dan penelusuran itu mengubah
beberapa di antaranya.

### Ready (4 epic, 8 issue)

| Epic | Isi | Temuan yang mengubah bentuknya |
|---|---|---|
| [#77](https://github.com/xpasqa/better-than-yesterday/issues/77) Metadata terurai | Pratinjau parse di quick-add · ikon recurring di `TaskRow` | Dua sisa yang tampak tak berhubungan ternyata **satu masalah**: parser sudah mengerti, UI tidak pernah memberitahu. `grep -rn "spans" apps/web/src` → nol pemakai |
| [#78](https://github.com/xpasqa/better-than-yesterday/issues/78) Settings | `PATCH /api/me` · halaman `/settings` | **Jauh lebih kecil dari dugaan** — lihat di bawah |
| [#79](https://github.com/xpasqa/better-than-yesterday/issues/79) Keyboard shortcut | Listener global · modal daftar | Yang menentukan berhasil-tidaknya bukan shortcut-nya, tapi **tiga penjaganya** |
| [#80](https://github.com/xpasqa/better-than-yesterday/issues/80) E2E Playwright | Pasang · tiga alur | Salah satu alurnya **menutup #24**, yang selama ini menahan #23 di Review |

### Backlog (2, sengaja)

| Kartu | Kenapa belum Ready |
|---|---|
| [#81](https://github.com/xpasqa/better-than-yesterday/issues/81) Drag reorder | Menunggu [#65](https://github.com/xpasqa/better-than-yesterday/issues/65) blok C mendarat. Blok C memperkenalkan seret HTML5 **pertama** di app ini; menulis rencana untuk seret kedua sebelum yang pertama ada berarti menebak idiomnya lalu menulis ulang. Dua cara menyeret yang berbeda lebih buruk daripada satu cara yang datang belakangan |
| [#82](https://github.com/xpasqa/better-than-yesterday/issues/82) Reminder & notifikasi | **Lubang terbesar.** Satu keputusan operasional menahannya: di mana penjadwalnya jalan — cron sistem (seperti `backup-db.sh` yang sudah ada), `node-cron` di kontainer, atau antrean sungguhan. Condong ke yang pertama, tapi itu bukan keputusan kode |

### Inbox (2 ide)

- [#74](https://github.com/xpasqa/better-than-yesterday/issues/74) — tiga kolom preferensi yang tidak menyetir apa pun
- [#76](https://github.com/xpasqa/better-than-yesterday/issues/76) — undo `⌘Z`, dipisahkan dari shortcut karena ia fitur
  undo yang kebetulan punya shortcut

### Bug yang ditemukan sambil jalan

[#75](https://github.com/xpasqa/better-than-yesterday/issues/75) — **chip tanggal di `AddTaskFormReal` merusak anchor
recurrence.** `anchorRecurrence` memanggang `BYMONTHDAY` dari `dueDate` saat
task dibuat; lalu `handleSubmit` menimpa `dueDate` lewat `updateNode` **tanpa
menghitung ulang `recurrence`**. Mengetik `bayar listrik setiap bulan` lalu
memilih tanggal 20 lewat chip menghasilkan `dueDate=20` dengan
`BYMONTHDAY=8` — task berulangnya berpindah hari permanen.

Kelas yang sama dengan #25, dan tidak ada di board karena ia bug, bukan
fitur.

### Tiga hal yang berubah setelah ditelusuri

**Settings jauh lebih kecil dari yang dicatat.** `todo.md` menulis "timezone
user memakai default `Asia/Jakarta`" — itu **fallback**, bukan hardcode.
Timezone sudah dipakai di sembilan tempat; yang hilang cuma cara mengubahnya.

**Dan tiga dari empat kolom preferensi tidak menyetir apa pun.** `language`
paling menipu: ia ada di `ParseContext` dan dioper dari dua komponen, tapi
`grep -n "language" packages/core/src/parse.ts` cuma menemukan **baris
deklarasinya**. Parser mencocokkan kata Indonesia dan Inggris sekaligus,
tanpa syarat. Parameter itu mati sejak lahir. `week_start` dan
`default_remind_time` juga tidak pernah dibaca.

Karena itu #78 **hanya** menangani timezone: kenop yang tidak tersambung ke
apa pun lebih buruk daripada tidak ada kenop.

**"Sorotan spans di dalam input" diganti pratinjau di bawahnya.** `<input>`
tidak bisa memuat markup, jadi tekniknya harus mirror div dengan font,
padding, dan scroll yang sinkron piksel-per-piksel — sorotan yang mendarat di
huruf salah adalah bug yang tidak pernah benar-benar selesai. Pratinjau di
bawah menyampaikan hal yang sama **plus** nilai hasilnya (`10 Agu`), yang
sorotan warna tidak bisa. Untuk `minggu depan` justru itu yang paling
penting.

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

- [ ] Enam belas kartu di §3 semuanya **Done** — dengan verifikasi
      benar-benar dijalankan, bukan cuma tes hijau (aturan 5)
- [ ] Lima daftar bawaan lengkap dan benar: Inbox, Today, Upcoming, Anytime,
      Someday
- [ ] Logbook memuat riwayat task biasa **dan** task berulang
- [x] Blok I (reminder & notifikasi) punya spec — [#82](https://github.com/xpasqa/better-than-yesterday/issues/82)
- [x] Sisa blok E/F/H/J di §4 punya kartu
- [ ] Keputusan penjadwal [#82](https://github.com/xpasqa/better-than-yesterday/issues/82) diambil, supaya plan-nya bisa ditulis
- [ ] [#75](https://github.com/xpasqa/better-than-yesterday/issues/75) diperbaiki — ia merusak task berulang secara diam-diam
- [ ] `npm run verify` hijau; `packages/core` tetap tanpa I/O

Yang **tidak** jadi syarat: paritas fitur dengan Todoist. Itu bukan lagi
tujuannya sejak [policy 3](../../../policy/3-product-policy.md) — judul spec
induk ("Paritas Todoist") sekarang menyebut sasaran yang sudah ditinggalkan,
dan sebaiknya diperbaiki saat ada yang menyentuh file itu lagi.
