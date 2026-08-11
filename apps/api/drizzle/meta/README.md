# Peringatan: rantai snapshot migrasi patah

`drizzle-kit generate` menghitung migrasi baru dengan mem-*diff* schema TypeScript
terhadap snapshot migrasi terakhir di folder ini. Rantai snapshot itu **tidak
utuh**:

- Snapshot per-migrasi untuk `0001`–`0006` tidak pernah ada (masalah lama, bukan
  akibat fitur Finance — ditemukan saat Task A fitur `30.finance`).
- `0007_snapshot.json` dulu ada tapi isinya salah: ia salinan persis
  `0000_snapshot.json` (nol tabel finance, kolom finance di `app_user` tidak
  ada), efek samping `drizzle-kit generate --custom` yang dipakai untuk
  mem-bypass bug tooling di atas. Snapshot itu **sudah dihapus** — dibiarkan ada
  jauh lebih berbahaya daripada tidak ada: `generate` berikutnya akan mem-diff
  terhadap baseline yang salah dan menghasilkan `CREATE TABLE finance_account`
  lagi, yang pasti gagal di database mana pun yang sudah termigrasi.

## Sebelum menjalankan `drizzle-kit generate`

Jangan langsung `npm run db:generate`. Pilih salah satu:

1. **Perbaiki rantainya dulu** — `drizzle-kit introspect` (alias `pull`) terhadap
   database yang sudah termigrasi penuh, lalu jadikan hasilnya snapshot baseline
   yang benar.
2. **Atau tulis SQL migrasinya tangan** — persis seperti yang dilakukan migrasi
   `0007_finance_schema.sql`, lalu daftarkan entry-nya di `_journal.json`.

`drizzle-kit migrate` (menjalankan migrasi) tidak terpengaruh: ia hanya membaca
`_journal.json` dan berkas `.sql`-nya.
