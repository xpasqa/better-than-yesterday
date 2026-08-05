# Todo: Backend Storage — Drive di iDrive e2

Urutan eksekusi [spec.md](spec.md). Prasyarat: fase 0 (infra), fase 1 (Todo,
untuk `node`), fase 3 (Agent, untuk `agent_project`) selesai. Tiap blok
berakhir dengan verifikasi; `npm run verify` adalah gate di setiap commit.

Urutannya dipilih supaya **area `personal` dan halaman Storage berdiri
sendiri lebih dulu** (blok A–G) — bisa dipakai dan diuji tanpa menyentuh
Todo/Outline/Agent — baru kemudian dikaitkan ke ketiga domain lain (blok H)
sebagai lapisan tambahan, bukan prasyarat.

## A. Core — validasi & pohon folder murni

- [ ] `core/storage-validate.ts` — `validateUpload(input, quota)`: cek
      ukuran (maks 50 MB), MIME allowlist vs blocklist (`.html` ditolak
      eksplisit), nama 1–255 karakter setelah trim
- [ ] `core/storage-tree.ts` — `wouldCreateCycle(folders, folderId,
      newParentId)`, pola sama seperti deteksi siklus `core/tree.ts` fase 1
- [ ] Tes tabel input→output untuk keduanya — **100% branch** pada
      `storage-validate.ts` (satu-satunya pagar sebelum kunci presign
      ditandatangani, spec §5.1)
- [ ] **Verifikasi:** `npm test` hijau; tidak ada I/O di kedua modul

## B. Skema

- [ ] `db/schema/storage.ts` — `storage_area` (CHECK bentuk owner, dua
      index unik parsial), `storage_folder`, `storage_file` (CHECK ukuran
      > 0, index `(area_id, folder_id)`, index parsial `ready`/`pending`)
- [ ] `ALTER app_user ADD COLUMN storage_quota_bytes` default 10 GiB
- [ ] `scripts/user.ts add` diperluas: membuat area `personal` transaksional
      bersama baris user (pola sama dengan root Inbox fase 1)
- [ ] `scripts/user.ts set-quota <email> <gb>` — ubah kuota tanpa menyentuh
      baris lain
- [ ] **Verifikasi:** migrasi jalan bersih dari kosong; `user add` baru
      langsung punya satu baris `storage_area(kind='personal')`

## C. Klien S3 & alur presign→confirm

- [ ] `db/s3-client.ts` — `@aws-sdk/client-s3` + presigner, dikonfigurasi
      dari env `S3_ENDPOINT`/`S3_REGION`/`S3_ACCESS_KEY_ID`/
      `S3_SECRET_ACCESS_KEY`/`S3_BUCKET` (ditambahkan ke `config.ts`, gagal
      = mati saat start, mengikuti pola infra §7)
- [ ] `modules/storage/routes.ts` — `POST /files/presign`: validasi via
      `core/storage-validate.ts`, cek kuota (§7 spec), `INSERT
      storage_file(status='pending')`, terbitkan PUT presigned (5 menit,
      kondisi `Content-Length`)
- [ ] `POST /files/:id/confirm` — `HeadObject`, cocokkan ukuran, `UPDATE
      status='ready'`; tidak cocok → `409`, baris tetap `pending`
- [ ] `GET /files/:id/download` — presigned GET 60 detik,
      `ResponseContentDisposition: attachment` untuk mime bukan
      gambar/PDF, setelah verifikasi kepemilikan (404 kalau bukan milik
      sesi)
- [ ] **Verifikasi (integrasi, lawan iDrive e2 bucket test):** presign→PUT
      langsung dari test→confirm→download mengembalikan byte yang sama;
      confirm dengan ukuran tidak cocok → 409

## D. Folder, tree, dan area malas

- [ ] `GET /tree?area=&owner=` — verifikasi owner (untuk area ber-owner)
      milik sesi via query ke `node`/`agent_project`, upsert area kalau
      belum ada, kembalikan folder+file satu pohon
- [ ] `POST /folders`, `PATCH /folders/:id` (rename & move, tolak siklus via
      `core/storage-tree.ts`, tolak pindah lintas area), `DELETE
      /folders/:id` (CTE rekursif kumpulkan `s3_key` → `DeleteObjects` →
      hapus baris)
- [ ] `PATCH /files/:id` (rename & move folder), `DELETE /files/:id`
      (hapus objek S3 lalu baris)
- [ ] **Verifikasi (integrasi):** siklus folder ditolak; pindah lintas area
      ditolak; hapus folder menghapus seluruh objek turunannya dari bucket
      test, bukan cuma barisnya

## E. Kuota

- [ ] `GET /usage` — `SUM(size_bytes) WHERE status='ready'` vs
      `storage_quota_bytes`
- [ ] Presign menolak `422 QUOTA_EXCEEDED` tepat di batas (`used + size >
      quota`)
- [ ] **Verifikasi:** upload tepat sampai batas kuota diterima; satu byte
      lebih ditolak sebelum presign diterbitkan

## F. Sweep mingguan

- [ ] `modules/storage/sweep.ts` — `node-cron` Minggu 03:00, in-process
      (tanpa broker, policy §2): hapus `pending` > 24 jam (objek dulu kalau
      sempat ter-upload, lalu baris); hapus area yang owner-nya
      `deleted_at`/tidak ada > 24 jam (objek seluruh turunan lalu area)
- [ ] Log satu baris per run: jumlah baris & byte diperoleh kembali
- [ ] **Verifikasi (integrasi):** baris pending 25 jam disapu, baris pending
      1 jam tidak; area milik node yang di-soft-delete 25 jam lalu disapu
      beserta objeknya

## G. Migrasi frontend — halaman Storage berdiri sendiri

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

- [ ] Widget lampiran di `TaskDetailModal.tsx` (fase 1): daftar file
      `area=todo-attachment&owner=<node.id>`, unggah/unduh kecil
- [ ] Widget serupa di baris Outline (fase 2) untuk `area=outline`
- [ ] Tab/area "File Agent" di halaman Storage: `area=agent&owner=
      <agent_project.id>`, hanya lihat/unggah/unduh/hapus (tanpa baca isi —
      itu tetap wewenang `agent_file` fase 3)
- [ ] **Verifikasi:** lampirkan berkas dari `TaskDetailModal` → muncul di
      area `todo-attachment` task itu di halaman Storage juga; sisipkan
      berkas di baris Outline → muncul di area `outline` baris itu

## I. Kontrak endpoint untuk Agent (tanpa wiring tool)

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
      download, rename, delete milik user A, untuk keempat area
- [ ] `.env.example` diperluas: `S3_ENDPOINT`, `S3_REGION`,
      `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`
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
