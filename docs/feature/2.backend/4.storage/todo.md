# Todo: Backend Storage — Drive di iDrive e2

Urutan eksekusi [spec.md](spec.md). Prasyarat: fase 0 (infra), fase 1 (Todo,
untuk `node`), fase 3 (Agent, untuk `agent_project`) selesai. Tiap blok
berakhir dengan verifikasi; `npm run verify` adalah gate di setiap commit.

**Diaudit ulang 2026-08-07 (issue #22):** dokumen ini sebelumnya menunjukkan
0/44 padahal sebagian besar backend (blok A–F) sudah ditulis dan live di
production. Checklist di bawah sudah disesuaikan dengan kode aktual —
lihat catatan di tiap item yang menyimpang dari spec awal.

Urutannya dipilih supaya **area `personal` dan halaman Storage berdiri
sendiri lebih dulu** (blok A–G) — bisa dipakai dan diuji tanpa menyentuh
Todo/Outline/Agent — baru kemudian dikaitkan ke ketiga domain lain (blok H)
sebagai lapisan tambahan, bukan prasyarat.

## A. Core — validasi & pohon folder murni

- [x] `core/storage-validate.ts` — `validateUpload(input, quota)`: cek
      ukuran (maks 50 MB), MIME allowlist vs blocklist (`.html` ditolak
      eksplisit), nama 1–255 karakter setelah trim
- [x] `core/storage-tree.ts` — `wouldCreateCycle(folders, folderId,
      newParentId)`, pola sama seperti deteksi siklus `core/tree.ts` fase 1
- [ ] Tes tabel input→output untuk keduanya — **belum ada test sama sekali**
      untuk `storage-validate.ts`/`storage-tree.ts` (0 branch coverage, bukan
      100% seperti diwajibkan spec §5.1 — satu-satunya pagar sebelum kunci
      presign ditandatangani)
- [x] **Verifikasi:** `npm test` hijau; tidak ada I/O di kedua modul —
      hijau karena tidak ada test yang menyentuhnya, bukan karena teruji

## B. Skema

- [x] `db/schema/storage.ts` — `storage_area` (CHECK bentuk owner, dua
      index unik parsial), `storage_folder`, `storage_file` (CHECK ukuran
      > 0, index `(area_id, folder_id)`, index parsial `ready`/`pending`)
- [x] `ALTER app_user ADD COLUMN storage_quota_bytes` default 10 GiB
- [ ] `scripts/user.ts add` diperluas: membuat area `personal` transaksional
      bersama baris user — **belum**; implementasi aktual malas (lazy):
      `getOrCreatePersonalArea` di `service.ts` membuat area saat akses
      storage pertama, bukan saat `user add`. Berfungsi, tapi menyimpang
      dari pola spec (transaksional bersama Inbox fase 1)
- [ ] `scripts/user.ts set-quota <email> <gb>` — **belum ada**, tidak ada
      cara ubah kuota user selain lewat SQL manual
- [x] **Verifikasi:** migrasi jalan bersih dari kosong (lihat issue #17)

## C. Klien S3 & alur presign→confirm

- [x] `db/s3-client.ts` — `@aws-sdk/client-s3` + presigner, dikonfigurasi
      dari env `S3_ENDPOINT`/`S3_REGION`/`S3_ACCESS_KEY_ID`/
      `S3_SECRET_ACCESS_KEY`/`S3_BUCKET` (di `config.ts`, semua optional —
      503 di route storage kalau belum diisi, bukan mati saat start)
- [x] `modules/storage/routes.ts` — `POST /files/presign`: validasi via
      `core/storage-validate.ts`, cek kuota (§7 spec), `INSERT
      storage_file(status='pending')`, terbitkan PUT presigned (5 menit,
      kondisi `Content-Length`)
- [x] `POST /files/:id/confirm` — `HeadObject`, cocokkan ukuran, `UPDATE
      status='ready'`; tidak cocok → `409`, baris tetap `pending`
- [x] `GET /files/:id/download` — presigned GET, verifikasi kepemilikan
- [ ] **Verifikasi (integrasi, lawan iDrive e2 bucket test):** belum
      pernah dijalankan — menunggu kredensial S3 nyata (issue #14)

## D. Folder, tree, dan area malas

- [x] `GET /tree?area=&owner=` — upsert area kalau belum ada, kembalikan
      folder+file satu pohon
- [x] `POST /folders`, `PATCH /folders/:id` (rename & move, tolak siklus via
      `core/storage-tree.ts`), `DELETE /folders/:id` (kumpulkan `s3_key`
      rekursif via BFS in-app, bukan CTE SQL, lalu `DeleteObjects` →
      cascade DB — diperbaiki di issue #16, sebelumnya bocor objek S3)
- [x] `PATCH /files/:id` (rename & move folder), `DELETE /files/:id`
      (hapus objek S3 lalu baris)
- [ ] **Verifikasi (integrasi):** belum pernah dijalankan lawan bucket
      test nyata — menunggu kredensial S3 (issue #14)

## E. Kuota

- [x] `GET /usage` — `SUM(size_bytes) WHERE status='ready'` vs
      `storage_quota_bytes`
- [x] Presign menolak upload yang melebihi kuota tepat di batas (`used +
      size > quota`) — via `validateUpload`, dibungkus `422
      VALIDATION_ERROR` dengan `error.code = 'QUOTA_EXCEEDED'` di body,
      bukan `AppError` bertipe `QUOTA_EXCEEDED` sendiri seperti disebut
      spec — perilaku sama, bentuk response sedikit beda
- [ ] **Verifikasi:** belum diuji end-to-end (butuh S3 nyata)

## F. Sweep orphan

- [x] `modules/storage/sweep.ts` — timer in-process (`setTimeout`+
      `setInterval`, bukan `node-cron`): hapus `pending` **lebih dari 7
      hari** (bukan 24 jam seperti spec), objek S3 dulu lalu baris
- [ ] Sweep area yang owner-nya `deleted_at`/tidak ada > 24 jam — **belum
      diimplementasikan sama sekali**, hanya sweep file pending yang ada
- [x] Log satu baris per run: jumlah file yang disapu
- [ ] **Verifikasi (integrasi):** belum ada test untuk sweep sama sekali

## G. Migrasi frontend — halaman Storage berdiri sendiri

**Belum dimulai** — diblokir menunggu kredensial S3 (issue #14).
`StorageView.tsx` masih 100% `storageData.ts` mock.

- [ ] `storageData.ts` dihapus; `StorageView.tsx` mengambil tree dari
      `GET /api/storage/tree?area=personal`
- [ ] Konsep **area** di UI: tab/sidebar "Punyaku" cukup untuk blok ini
      (area lain menyusul blok H)
- [ ] Tombol/drag-drop unggah: pilih berkas → presign → `PUT` langsung
      (progress dari `XMLHttpRequest.upload.onprogress`) → confirm → file
      muncul di list
- [ ] Klik file → `GET /files/:id/download` → buka/unduh
- [ ] Rename/delete folder & file memanggil endpoint sungguhan, bukan
      `setState` lokal murni
- [ ] Bar kuota di header dari `GET /usage`
- [ ] State error: ukuran/MIME ditolak, kuota penuh, confirm gagal
- [ ] **Verifikasi:** unggah berkas ke folder personal → muncul dengan
      ukuran benar → unduh → isi identik (hash cocok)

## H. Integrasi lintas-fase — Todo, Outline, Agent

**Belum dimulai.**

- [ ] Widget lampiran di modal detail task (fase 1): daftar file
      `area=todo-attachment&owner=<node.id>`, unggah/unduh kecil —
      **catatan:** target aslinya `TaskDetailModal.tsx` sudah dihapus
      (issue #20, komponen mock mati); task detail yang real sekarang
      `NodeDetailModal.tsx`, widget ini perlu dipasang di sana
- [ ] Widget serupa di baris Outline (fase 2) untuk `area=outline`
- [ ] Tab/area "File Agent" di halaman Storage: `area=agent&owner=
      <agent_project.id>`, hanya lihat/unggah/unduh/hapus (tanpa baca isi —
      itu tetap wewenang `agent_file` fase 3)
- [ ] **Verifikasi:** lampirkan berkas dari `TaskDetailModal` → muncul di
      area `todo-attachment` task itu di halaman Storage juga; sisipkan
      berkas di baris Outline → muncul di area `outline` baris itu

## I. Kontrak endpoint untuk Agent (tanpa wiring tool)

**Belum dimulai.**

- [ ] Tes kontrak: `GET /tree`, `POST /files/presign`, `DELETE /files/:id`
      dipanggil dengan `area=agent&owner=<projectId>` berperilaku identik
      dengan area lain — tidak ada endpoint baru, tidak ada cabang kode
      khusus agent di modul storage
- [ ] Catat di PR: pendaftaran tool AI SDK yang memanggil endpoint ini
      **tidak** dikerjakan di fase ini — itu perubahan tool agent, wajib
      ditanyakan dulu (policy §8 spec induk)
- [ ] **Verifikasi:** kontrak di atas lulus lawan Postgres + bucket test
      dengan `agent_project` sungguhan

## J. Isolasi, sweep produksi, dan penutup

- [ ] Kasus baru di `test/isolation.test.ts`: user B → 404 atas tree,
      download, rename, delete milik user A, untuk keempat area — **belum
      ada satu pun test storage di `isolation.test.ts`**
- [x] `.env.example` diperluas: `S3_ENDPOINT`, `S3_REGION`,
      `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET` — dan
      `docker-compose.yml` diperbaiki agar benar-benar meneruskannya ke
      container (issue #21, sebelumnya env var ini tidak pernah sampai ke
      API meski diisi di `.env`)
- [ ] CORS bucket iDrive e2 diset (`PUT`/`GET` dari origin app) — dicatat di
      README deploy, bukan di kode
- [ ] E2E Playwright: unggah ke personal → unduh; lampirkan ke task →
      terlihat di Storage
- [ ] **Verifikasi:** seluruh Success Criteria spec §13 tercentang

## Definisi selesai fase 4

Lampiran task, file Outline, dan artefak biner Agent masing-masing punya
rumah yang terlihat terpisah di UI meski berbagi satu mesin upload/kuota/
sweep. Folder pribadi bisa dipakai sebagai laci dokumen sehari-hari.
Endpoint untuk tool storage Agent sudah ada dan teruji, siap didaftarkan
sebagai tool di sesi kerja fase 3 lanjutan begitu ditanyakan dan disetujui.
