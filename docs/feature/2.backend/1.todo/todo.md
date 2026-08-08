> **Peta finalisasi:** untuk urutan pengerjaan sisa fitur dan apa yang belum
> punya kartu di board, baca [`finalisasi.md`](finalisasi.md).

# Todo: Backend Todo — Paritas Todoist

Urutan eksekusi [spec.md](spec.md). Prasyarat: fase 0 selesai. Tiap blok
berakhir dengan verifikasi; `npm run verify` adalah gate di setiap commit.

Urutannya dipilih supaya **aplikasi bisa dipakai sedini mungkin**: blok A–E
sudah menghasilkan Todoist yang berfungsi penuh untuk satu hari kerja;
sisanya menambah lapisan.

> **Status (2026-08-06):** A, B (untuk `node`), C, dan E selesai dan
> terverifikasi manual di browser + otomatis. D selesai sebagian — hanya
> view Today yang benar-benar dikabelkan ke UI baru (`TodayReal.tsx`),
> bukan refactor `MainContent.tsx` yang sesungguhnya. F–J belum dimulai.
> Rincian di laporan akhir sesi.
>
> **Update 2026-08-07 (issue #22, audit ulang):** sejak status di atas
> ditulis, Today/Inbox/Upcoming/Project semuanya sudah dikabelkan ke UI
> real (`TodayReal`/`InboxReal`/`UpcomingReal`/`ProjectReal`), dan
> `MainContent.tsx`/`BoardView.tsx`/`mockData.ts`'s `tasks`/`projects`/
> `labels` sudah **dihapus total** (issue #20) — bukan direfactor,
> dihapus, karena satu-satunya jalan ke sana ("Filters & Labels" nav)
> selalu kosong di production. Checklist di bawah disesuaikan; beberapa
> item blok C/D yang tadinya "belum" karena menunggu file itu sekarang
> jadi tidak relevan lagi (filenya sudah tidak ada, bukan "sudah
> diperbaiki" dalam arti yang dimaksud item aslinya) — dicatat per item.

## A. Core — aturan sebelum penyimpanan

- [x] `core/rank.ts` — `between(a, b)`, `rebalance(ranks)` + tes: rank
      duplikat, pertumbuhan panjang, sisipan berulang di posisi sama
- [x] `core/tree.ts` — `indent` `outdent` `move` (mencakup insert/reparent);
      tolak siklus + tes tiap operasi termasuk no-op. `complete` belum jadi
      fungsi core terpisah — sejauh ini ditulis langsung di
      `node-actions.ts` (`toggleTaskComplete`), bukan `core/tree.ts`
- [x] `core/date.ts` — resolusi tanggal lewat timezone eksplisit (bukan UTC,
      bukan jam device) — nama fungsi `localDate`/`todayInTimezone`, bukan
      persis seperti draf awal
- [x] **Verifikasi:** `npm test` hijau; tidak ada I/O di `core`

## B. Skema & sync multi-entitas

- [x] `db/schema/node.ts` — tabel `node` + index + CHECK (jam butuh tanggal,
      recurring butuh tanggal) + `is_inbox` (koreksi dari `ROOT_INBOX_ID`
      bersama — lihat spec §3.1a)
- [x] `db/schema/label.ts`, `saved_filter`, `reminder`, `notification`,
      `push_subscription`, `completion` — **skema ada, tapi belum ada route
      sync untuk kelimanya.** `modules/sync/routes.ts` saat ini hanya
      membawa entitas `nodes`; `labels`/`filters`/`reminders` di kontrak
      wire (`dto.ts`) belum ditambahkan
- [x] `ALTER app_user` — timezone, week_start, default_remind_time,
      digest_time, language
- [x] Satu sequence `seq` (`sync_seq`) dipakai semua tabel syncable
- [x] `modules/sync/routes.ts` — `POST /api/sync` untuk `nodes`: Zod, LWW
      baris (termasuk penjaga lintas-user pada `onConflictDoUpdate`), batch
      500, **selalu `WHERE user_id`**. Envelope multi-entitas penuh
      (labels/filters/reminders/notifications turun) **belum**
- [x] `scripts/user.ts add` — membuat root Inbox milik user baru,
      transaksional
- [x] **Verifikasi (integrasi, Postgres asli):** bootstrap cursor "0"; LWW dua
      arah; tombstone; cursor tertinggal; batch > 500 ditolak; **kasus
      isolasi baru di `test/isolation.test.ts`** — termasuk percobaan
      user B menimpa node user A lewat id yang sama, ditolak diam-diam dan
      diverifikasi manual lewat curl sebelum ditulis jadi tes

## C. Store klien & pemindahan data

- [x] `apps/web/src/store/` — Dexie (`db.ts`), outbox (koalesk per node id
      di `db.outbox`, keyed by `nodeId`), sync client (`sync-client.ts`:
      debounce 400 ms + polling 5 detik, banner offline, retry otomatis)
- [x] `mockData.ts` dihapus; `projects`/`labels` dialirkan lewat store —
      **tercapai lewat rute berbeda dari yang dibayangkan item ini**:
      bukan `projects`/`labels` mock "dialirkan" jadi data real, tapi
      `mockData.ts`'s `tasks`/`projects`/`sections`/`labels` (dan seluruh
      komponen yang memakainya — `MainContent`, `BoardView`,
      `TaskDetailModal`, dll) dihapus total karena satu-satunya jalan ke
      sana selalu kosong (issue #20). `mockData.ts` sekarang cuma berisi
      `mailMessages` (mock Mail, memang disengaja, di luar scope fase ini)
- [x] Id klien → `core/id.ts` (UUIDv7) — dipakai di `node-actions.ts`
- [x] Hard delete → `deleted_at` — `node-actions.ts` sekarang satu-satunya
      jalur delete task yang ada; `App.tsx`'s `handleDeleteTask` (mock,
      hard-delete) sudah dihapus bersama seluruh state mock (issue #20),
      bukan "diperbaiki" — jalur lamanya sudah tidak ada. `subTasks[]`
      masih belum di-flatten — tidak ada UI subtask di real views
- [x] **Verifikasi:** matikan API → quick-add & toggle-complete tetap jalan +
      banner "Offline — changes saved locally"; nyalakan → konvergen otomatis
      dalam satu interval poll, dikonfirmasi langsung di Postgres

## D. View & refactor MainContent

- [x] `core/views.ts` — `today` (+blok overdue), `upcoming`, `inbox`,
      `project`, `completed`, plus `subtreeDepthFirst` (dipakai bersama
      Outline nanti) + tes tiap fungsi. **Belum ada:** `label`, `search`,
      grouping/sorting selain urutan today (tanggal/prioritas/project/
      section)
- [x] **`MainContent.tsx` dipecah** — bukan direfactor, **dihapus**
      (issue #20): `TodayReal`/`InboxReal`/`UpcomingReal`/`ProjectReal`
      sudah menggantikannya penuh untuk empat view utama; `MainContent.tsx`
      dan `BoardView.tsx` sendiri (beserta `TaskItem`/`TaskList`/
      `TaskDetailModal`/`AddTaskForm` yang cuma dipakai olehnya) sudah
      tidak ada di repo. Tujuan aslinya (lapisan view yang maintainable,
      berbasis data real) tercapai lewat rute berbeda dari yang
      dibayangkan item ini — dicatat di sini, bukan diam-diam dianggap
      selesai dengan cara yang sama
- [x] Badge sidebar dari store — `Sidebar.tsx`'s `todayCount`/`inboxCount`
      sekarang murni dari `computeToday`/`computeInbox` (store real);
      prop `tasks` mock sudah dihapus dari `Sidebar` sepenuhnya (issue #20)
- [x] **Verifikasi (untuk Today saja):** task di kedalaman mana pun dengan
      `due_date` muncul; Upcoming (fungsi core, belum ada UI-nya) tidak
      memuat task tanpa tanggal; "hari ini" dihitung dari timezone user API,
      bukan UTC/jam device

## E. Quick add & tanggal natural

- [x] `core/parse.ts` — tanggal (relatif ID/EN, hari bernama + "depan"/
      "next", eksplisit d/m, ISO, nama bulan), jam (jam/bare/am-pm), durasi,
      `#project`, `@mention` (diekstrak, lihat catatan di bawah), `$label`,
      `!1–!4`, `spans` untuk penyorotan; aturan paling-kanan-menang dengan
      penanganan nested match. **Belum:** frasa relatif majemuk ("minggu
      depan" tanpa nama hari, "N hari lagi", "bulan depan", "akhir bulan")
      dan `core/recurrence.ts` — field `recurrence` selalu `null` di versi
      ini, didokumentasikan sebagai batas cakupan di kepala file
- [x] Tes tabel input→output + kalimat jebakan (harga `$5`, seruan `bagus!`,
      `p1` yang bukan token, dua tanggal/jam sekaligus, nested "jam 9:00") —
      57 tes lulus, **belum diukur coverage persisnya (%) tapi setiap
      cabang bersyarat di modul disentuh minimal satu tes**
- [ ] UI: penyorotan `spans` di dalam input (data sudah ada dari parser,
      belum dirender sebagai highlight); autocomplete `#`/`@`/`$` +
      tawaran buat baru — **belum**, quick-add saat ini kirim teks polos
- [ ] `q` (global) dan `a` (di view) membuka quick add — **belum ada
      shortcut**; input quick-add selalu terlihat di atas Today
- [x] **Verifikasi:** quick-add "rapat tim hari ini jam 2 siang #Work
      $penting !2" diuji langsung di browser — parse benar, tersimpan ke
      Postgres, tampil di Today terurut oleh jam — **dogfood-nya memang
      sudah bisa dimulai untuk Today**, tapi fitur di atas (highlight,
      autocomplete, shortcut) menyusul

## F. Project, section, label, board

- [ ] CRUD project/section lewat UI — **sebagian**: bikin project sekarang
      bisa lewat `CreateProjectModal.tsx` (fitur terpisah, issue #13/
      `8.add-project`), tapi rename/delete project, dan seluruh CRUD
      section (bikin/rename/hapus), masih belum ada UI-nya sama sekali.
      Quick-add's `#project` resolusi masih hanya pencarian substring
      case-insensitive di `node-actions.ts`
- [ ] Drag lintas section/project — belum (Today belum punya drag)
- [ ] Board — kode mock-nya dihapus di #20; yang dibangun sekarang adalah
      board sungguhan di atas `kind='section'`. Kolom **selalu** section
      (bukan menu grouping) — lihat
      [`policy/3-product-policy.md`](../../policy/3-product-policy.md) §2/§3
- [x] **Manajemen label — sekarang benar-benar berfungsi**, bukan cuma
      terlihat jalan: `db/schema/label.ts` dapat route sync sendiri
      (`modules/sync/routes.ts` mendukung entitas `labels` di envelope
      multi-entitas, satu cursor bersama `nodes`), Dexie punya tabel
      `labels`, dan `label-actions.ts` di klien meng-cocokkan `$name` dari
      parser ke label yang sudah ada (case-insensitive) atau membuat baru
      — dites lulus di 6 test backend (round-trip, LWW, isolasi
      antar-user, penolakan nama berspasi) **dan** diverifikasi manual di
      browser: dua task dengan `$rumah` menghasilkan **satu** baris label,
      dikonfirmasi langsung di Postgres. **Belum ada**: UI mengelola label
      (rename/warna/favorit/hapus) — hanya penciptaan implisit dari
      quick-add yang berjalan
- [ ] Warna/favorit/rename label lewat UI — masih belum ada. Halaman
      mock "Filters & Labels" yang dulu ada sebagai placeholder **sudah
      dihapus** (issue #20, selalu kosong di production); kalau
      dikerjakan sekarang, halaman realnya dibangun dari nol, bukan
      mengganti mock yang sudah ada

Catatan tersendiri, ditemukan saat mengerjakan blok ini: migrasi skema
Dexie dari v1 ke v2 sempat gagal total (`UpgradeError: Not yet support
for changing primary key`) karena percobaan pertama mengubah primary key
tabel `outbox` langsung — Dexie tidak mendukung itu. Diperbaiki mengikuti
pola resmi Dexie (tabel baru `pending` di versi 2 sambil migrasi data dari
`outbox` lama, lalu ganti nama balik ke `outbox` di versi 3) — lihat
`apps/web/src/store/db.ts`. **Siapa pun yang menambah kolom baru ke
tipe `Node`/`Label` di kemudian hari harus lewat `.stores()` yang menambah
index, bukan mengubah key path store yang sudah ada.**

## G. Pencarian

- [ ] Belum dimulai — `core/filter.ts` tidak ada

## H. Recurring

- [x] `core/recurrence.ts` — parser 8 pola frasa spec §8 (`findRecurrenceCandidates`)
      + `nextOccurrence()` (akhir bulan, tahun kabisat), 100% branch coverage
      (dikonfirmasi ulang di Task 9: `recurrence.ts` 100% stmt/branch/func/line)
- [x] Wired ke `core/parse.ts` — `recurrence` field terisi dari quick-add.
      `parse.ts` sendiri 100% statement/line/func coverage, **95.23% branch**
      — 4 baris tak tercakup (176, 186, 218, 224) semuanya di dalam
      `findDateCandidates`/`hourWithSuffix`, fungsi yang sudah ada *sebelum*
      plan recurring ini dan tidak disentuh satu task pun di plan ini. Ini gap
      lama yang sudah diketahui, dicatat sebagai utang teknis terpisah, bukan
      ditutup di sini — di luar cakupan spec §12's mandat 100% (mandat itu
      untuk `recurrence.ts`/`parse.ts` sebagai *hasil kerja plan ini*, bukan
      kode lama yang kebetulan berada di file yang sama)
- [x] `completion` table sync — push (insert-only, `onConflictDoNothing`) +
      pull, DTO, isolasi antar-user diverifikasi
- [x] Dexie `completions` table (v4 migration) + sync-client push/pull
- [x] `toggleTaskComplete` recurring-aware: majukan `due_date`, tulis
      `completion`, tidak menutup task; `skipRecurrence` majukan tanpa
      menulis `completion`
- [x] **Bug ditemukan & diperbaiki, dua putaran**: quick-add yang mengetik
      frasa recurring tanpa tanggal eksplisit (mis. "setiap hari", "setiap
      bulan", "setiap tahun" — enam dari delapan pola spec §8 memang
      wajarnya tidak disertai tanggal) akan membuat node dengan
      `recurrence` terisi tapi `due_date` `null` — melanggar CHECK
      constraint `node_recur_needs_date` di DB. Percobaan pertama (Task 8)
      men-drop `recurrence` jadi `null` kalau `dueDate` kosong — **ternyata
      salah**: whole-branch review (setelah Task 9) menemukan ini mematikan
      6 dari 8 pola sekaligus membuang teks frasa yang sudah diketik user
      tanpa jejak, karena `parse()` sudah men-strip frasa itu dari judul.
      Diperbaiki ulang di fix wave setelah review: `dueDate` di-default ke
      hari ini (`todayInTimezone`) kalau `recurrence` terdeteksi tapi
      tanggalnya kosong — `recurrence` tidak lagi di-drop. Sebagai lapis
      kedua, `enqueue()` (satu-satunya jalur tulis node) sekarang menjaga
      invarian yang sama untuk semua jalur lain (termasuk `updateNode`
      lewat tombol "Clear date" — tanpa penjaga ini, satu node yang
      melanggar constraint akan bikin seluruh antrean sync macet permanen
      karena outbox dikirim sebagai satu batch)
- [x] **Gap infrastruktur lintas-task ditemukan & diperbaiki**: `packages/
      core/package.json`'s `exports` map ketinggalan entri `./recurrence` dan
      `./completion` — kedua modul itu dibuat di Task 1 dan Task 4 tapi
      lupa didaftarkan sebagai subpath export, jadi import dari luar
      `packages/core` akan gagal resolve. Diperbaiki di Task 8. **Catatan
      untuk task berikutnya**: kalau menambah modul baru lagi ke
      `packages/core/src/`, jangan lupa tambahkan entrinya ke `exports` di
      `packages/core/package.json` — ini kedua kalinya kelas bug ini muncul
      di repo ini
- [ ] **Belum diverifikasi di browser sungguhan** — sepanjang plan recurring
      ini (Task 1–8), tidak pernah ada Chrome extension tersambung atau
      Playwright terpasang. Task 8 Step 4 (verifikasi manual di browser)
      secara eksplisit **dilewati**, bukan dicoba-dan-gagal — jadi belum ada
      konfirmasi visual/interaktif bahwa recurring bekerja end-to-end di
      browser sungguhan (quick-add "setiap bulan", centang task, cek
      due_date maju, cek baris `completion` di Postgres). Semua yang di atas
      hanya terverifikasi lewat tes otomatis (unit + integrasi Postgres asli
      untuk sync/isolation). **Masih pending** sampai ada sesi dengan
      tooling browser tersedia
- [x] **Whole-branch review (setelah Task 9) menemukan & memperbaiki dua
      lagi**: (1) `nodeDto.recurrence` di DTO sync tadinya `z.string()`
      bebas — sekarang divalidasi regex bentuk kanonik, karena
      `nextOccurrence` melempar error untuk apa pun yang tidak dikenali,
      dan `toggleTaskComplete` dipanggil `void` tanpa `.catch()` di 3
      tempat UI (error jadi unhandled rejection senyap kalau lolos). (2)
      `applyIncomingCompletions` (sync route) tadinya insert completion apa
      pun tanpa cek `nodeId` benar milik user pengirim — sekarang
      difilter ke node yang benar-benar dimiliki dulu, sejalan dengan
      Global Constraint "sync selalu di-scope `WHERE user_id`"
- [ ] UI indicator recurring di meta row TaskRow — sengaja di luar scope
      (sudah P3 terpisah di `9.task-row-metadata/todo.md`)

**Follow-up yang ditangguhkan (bukan blocker, dicatat biar tidak hilang):**
- `nextOccurrence` untuk `FREQ=MONTHLY`/`FREQ=YEARLY` tanpa `BYMONTHDAY`
  membaca ulang hari-of-month dari `fromDate` tiap panggilan — task yang
  jatuh tempo tanggal 29-31 bisa "hanyut" mundur permanen setelah melewati
  satu bulan pendek (mis. 31 Jan → 28 Feb → 28 Mar, bukan balik ke 31).
  Perlu keputusan desain: quick-add selalu emit `BYMONTHDAY` eksplisit,
  atau simpan anchor day terpisah.
- `nextOccurrence` pada task yang sudah lewat lama hanya maju satu langkah
  per centang (task harian yang diabaikan 3 minggu perlu 21× klik untuk
  jadi current) — Todoist maju ke kemunculan pertama setelah hari ini.
  Pertanyaan level-spec, bukan bug implementasi.
- Cek kepemilikan `nodeId` di `applyIncomingCompletions` (item di atas)
  belum punya test regresi khusus yang benar-benar gagal tanpa fix-nya —
  tes isolasi yang ada kebetulan memakai nodeId milik sendiri. Perlu satu
  tes baru: user B kirim completion dengan `nodeId` milik user A.
- `outline-actions.ts` dan `project-actions.ts` masing-masing punya
  `enqueueNode` sendiri (duplikat, bukan reuse dari `node-actions.ts`)
  tanpa penjaga dueDate/recurrence/dueTime yang baru ditambahkan ke
  `enqueue()` di sana. Belum ada jalur nyata yang bisa memicu ini hari
  ini (diverifikasi), tapi jadi jebakan laten kalau Outline nanti dapat
  tombol "clear date".

**Tiga temuan Minor ditangguhkan ke code review whole-branch** (bukan
diperbaiki di sini — sesuai proses plan ini, temuan Minor tidak masuk fix
loop per-task): (1) komentar header `apps/api/src/modules/sync/routes.ts`
masih bilang "`nodes` and `labels`" padahal `completion` sudah jadi entitas
sync ketiga; (2) komentar header `apps/api/test/isolation.test.ts` masih
bilang "the two synced entities" dengan alasan yang sama; (3)
`toggleTaskComplete`'s cabang recurring (node-actions.ts baris ~107–112)
menulis transaksi Dexie-nya sendiri inline (put node + put outbox + put
completion + put outbox) alih-alih memanggil ulang helper `enqueue()` yang
sudah ada — duplikasi pola tulis, bukan bug. Ketiganya dikonfirmasi masih
ada per commit `6f4a869` (HEAD sebelum commit Task 9 ini); controller
menangani lewat review whole-branch terpisah setelah task ini.

## I. Reminder & notifikasi

- [ ] Belum dimulai — tabel `reminder`/`notification`/`push_subscription`
      ada di skema tapi tidak ada scheduler, tidak ada route push, tidak
      ada UI

## J. Pelengkap

- [ ] Halaman Settings — belum (timezone user memakai default `Asia/Jakarta`
      dari `app_user`, tidak ada UI untuk mengubahnya)
- [ ] Keyboard shortcut — belum, di luar submit form biasa (Enter)
- [ ] `⌘Z` undo — belum
- [ ] E2E Playwright — belum ada test runner Playwright terpasang; jalur
      "quick-add → Today → centang" sudah diverifikasi **manual** via
      browser tool, bukan sebagai E2E otomatis
- [x] Cron backup `pg_dump` — aktif (issue #21), lihat
      `0.infrastructure/todo.md` untuk detail

## Definisi selesai fase 1

Tiga user memakainya dari HP dan laptop, dan owner melewati **dua minggu
berturut-turut tanpa membuka Todoist**. Repo siap menerima fase 2 (Outline)
tanpa migrasi skema baru — pohonnya sudah ada. **Belum tercapai**: fase 1
punya empat jalur nyata (Today/Inbox/Upcoming/Project + quick-add) yang
bekerja penuh dan terverifikasi (migrasi total menjauh dari `mockData.ts`
untuk data task sudah tercapai, issue #20), tapi blok F–J — CRUD project/
section, rename/delete project, manajemen label (warna/rename/favorit),
Board, filter tersimpan, recurring, dan notifikasi — masih di depan
sebelum kriteria ini bisa dicentang. Belum ada 3 user asli yang memakainya
sama sekali (masih 1 user test) — lihat `0.infrastructure/todo.md`.
