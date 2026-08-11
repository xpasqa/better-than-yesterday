# Todo: Finance (Personal + Bisnis)

Checklist hidup ada di issue epic **[EPIC] Finance** (nomor diisi saat epic
dibuat di GitHub).

Rincian langkah: [plan.md](plan.md). Alasan tiap keputusan: [spec.md](spec.md).

## Status

- [ ] Blok A — skema tiga tabel, setting di `app_user`, seed lazy
- [ ] Blok B — `finance-validate` (§6) dan `finance-action` (§7) di `@better/core`
- [ ] Blok C — query agregasi §9.1–9.7
- [ ] Blok D — endpoint baca: overview, summary, accounts, receivables, networth, transactions
- [ ] Blok E — endpoint tulis: CRUD transaksi, idempotency, cascade §11.2, CRUD akun & kategori
- [ ] Blok F — shell web: tipe, route bertab, item sidebar, klien API
- [ ] Blok G — beranda: headline, ringkasan, progress target, chip
- [ ] Blok H — daftar situasi dan form per aksi
- [ ] Blok I — tab Riwayat, Akun (+kekayaan bersih), Piutang
- [ ] Blok J — setup awal tiga pertanyaan, toggle bisnis
- [ ] Blok K — e2e alur 90%
- [ ] Verifikasi di browser sungguhan (syarat Done, bukan `npm run verify`)

## Urutan ketergantungan

```
A ──► B ──► C ──► D ──► E
                        │
                        ▼
                        F ──► G ──► H
                        │      │
                        │      ▼
                        └────► I ──► J ──► K
```

- **B butuh A** hanya untuk tipe `TransactionDraft` yang dipakai bersama;
  fungsinya sendiri murni dan bisa ditulis paralel kalau perlu.
- **F butuh E** karena klien API memanggil endpoint tulis.
- **G, H, I** semuanya butuh F; H dan I bisa dikerjakan paralel setelah G.
- **K terakhir** — ia menguji rantai yang utuh.

## Prasyarat sekali jalan

```bash
docker compose -f docker-compose.test.yml up -d
DATABASE_URL=postgresql://postgres@127.0.0.1:55432/better_test \
  npm run db:migrate -w @better/api
```

Ulangi perintah `db:migrate` setiap kali blok A mengubah skema.
