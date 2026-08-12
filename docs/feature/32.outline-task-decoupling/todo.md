# Todo: Outline dilepas dari Todo

Checklist hidup ada di issue epic **[EPIC] Outline dilepas dari Todo** (nomor
diisi saat epic dibuat di GitHub).

Rincian langkah: [plan.md](plan.md). Alasan tiap keputusan: [spec.md](spec.md).
Riwayat percabangan: [context.md](context.md).

## Status

- [ ] Blok A — `kind='note'` + kolom `linked_task_id` di seluruh rantai tipe
- [ ] Blok B — migrasi data lama: `item` yatim diturunkan jadi `note`
- [ ] Blok C — tes penguncian turunan `kind`, dan search ikut mencari catatan
- [ ] Blok D — Outline membuat `note`, bukan `item`
- [ ] Blok E — autocomplete `#project` dan popup detail task
- [ ] Blok F — chip status live, centang dua arah, penghapusan independen
- [ ] Blok G — e2e rantai utuh + memperbarui spec 2.outline
- [ ] Verifikasi di browser sungguhan (syarat Done, bukan `npm run verify`)

## Urutan ketergantungan

```
A ──┬──► B
    │
    ├──► C
    │
    └──► D ──► E ──► F ──► G
```

- **Semua butuh A** — `note` harus sah di DB, DTO, dan tipe sebelum ada yang
  membuat atau memfilternya.
- **B dan C tidak saling butuh** dan bisa jalan paralel setelah A.
- **D adalah blok yang menghentikan pencemaran.** Setelah D, baris baru
  bersih; B yang membersihkan yang lama. Keduanya diperlukan.
- **E butuh D** karena popup menautkan dari sebuah node `note`.
- **G terakhir** — ia menguji rantai yang utuh.

## Prasyarat sekali jalan

```bash
docker compose -f docker-compose.test.yml up -d
```

```bash
DATABASE_URL=postgresql://postgres@127.0.0.1:55432/better_test npm run db:migrate -w @better/api
```

Ulangi `db:migrate` setiap kali blok A atau B mengubah skema.
