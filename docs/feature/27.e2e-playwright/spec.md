# Spec: E2E Playwright

**Tanggal:** 2026-08-08
**Status:** disetujui, siap diimplementasi
**Menutup:** `1.todo/todo.md` blok J baris "E2E Playwright"

---

## 1. Konteks

`1.todo/spec.md` mendaftarkan Playwright di tabel verifikasi sejak awal, dan
`todo.md` blok J mencatat: *"belum ada test runner Playwright terpasang"*.
Benar — tidak ada `playwright` di `package.json` mana pun, dan `npm run verify`
berisi `typecheck && lint && test && build`, semuanya unit dan tipe.

Ini bukan kekurangan teoretis. Epic recurring baru saja menunjukkan
akibatnya: **dua bug lolos dari sembilan review per-task**, keduanya sekelas
"baris melanggar CHECK → 500 saat sync → seluruh outbox macet". Tidak satupun
tes unit bisa melihatnya, karena tiap bagian benar sendiri-sendiri. Yang
melihatnya cuma menjalankan aplikasi sungguhan.

Dan #24 — verifikasi manual recurring — masih terbuka, menahan #23 di Review.
Itu persis pekerjaan yang seharusnya dilakukan mesin.

---

## 2. Scope

**In:**
- Playwright terpasang + konfigurasi + `npm run test:e2e`
- Satu berkas helper untuk login (semua tes butuh sesi)
- **Dua** alur: quick-add → Today → selesai · offline → antre → sync

**Out (dengan alasan):**
- **Memasukkan e2e ke `npm run verify`** — verify dipakai tiap task oleh
  implementer subagent dan harus tetap cepat. E2E butuh Postgres dan server
  hidup. Ia perintah tersendiri, dijalankan sebelum merge.
- **CI** — belum ada pipeline CI sama sekali. Menambahkannya bersamaan berarti
  mendebug dua hal baru sekaligus saat gagal.
- **Cakupan lintas browser** — Chromium saja. Tiga browser melipattigakan
  waktu jalan demi menangkap kelas bug yang belum pernah kita alami.
- **Tes untuk fitur yang belum ada** — tabel E2E di `1.todo/spec.md` juga
  menyebut seret kartu board dan rename label. Keduanya belum dibangun; tesnya
  ikut fiturnya, bukan mendahuluinya.

---

## 3. Kenapa dua alur ini

Bukan yang paling mudah ditulis — yang **paling mungkin rusak diam-diam**.

**Alur 1 — quick-add → Today → selesai.** Ia melewati parser, resolusi
project, penulisan Dexie, outbox, `POST /api/sync`, CHECK di Postgres, lalu
kembali ke perhitungan view. Itu persis rantai tempat kedua bug recurring
bersembunyi. Kalau satu sambungan putus, tes ini merah.

**Alur 2 — offline → antre → sync.** Offline-first adalah janji inti app ini
(`todo.md` blok C memverifikasinya **dengan tangan**). Ia juga jalur yang
paling tidak mungkin diuji orang secara manual dua kali, karena merepotkan:
matikan API, kerjakan sesuatu, hidupkan lagi, tunggu. Persis kandidat untuk
diotomasi.

Alur 2 memakai `page.route()` untuk memblokir `**/api/sync`, bukan mematikan
kontainer — tesnya harus bisa jalan tanpa hak akses Docker.

---

## 4. Keputusan desain

| Keputusan | Alasan |
|---|---|
| **Server hidup sungguhan + Postgres sungguhan**, bukan API tiruan | Kedua bug recurring adalah **pelanggaran CHECK di Postgres**. API tiruan akan menerima keduanya dengan senang hati dan tesnya hijau. |
| **User tes sendiri lewat `scripts/user.ts add`** | Skripnya sudah ada dan sudah membuat root Inbox — persis bootstrap yang dibutuhkan. Tidak perlu jalur pembuatan user kedua. |
| **Database dibersihkan per file, bukan per tes** | Kompromi sadar: isolasi per tes lebih bersih tapi jauh lebih lambat. Tiap file memakai user sendiri, jadi tidak saling mengganggu. |
| **`webServer` milik Playwright** | Ia sudah menangani "tunggu port siap" dan mematikan proses saat selesai — dua hal yang selalu salah kalau ditulis tangan. |
| **Selector lewat `getByRole`/`getByLabel`** | `QuickAddBar` sudah punya `aria-label="Quick add a task"`; `BoardCard` punya `aria-label` per tombol. Selector berbasis peran ikut menguji aksesibilitas, dan tidak patah saat kelas CSS berubah. |

---

## 5. Blok kerja

| Blok | Isi |
|---|---|
| A | Pasang Playwright, `playwright.config.ts`, `webServer`, helper login, skrip npm |
| B | Dua alur di §3 |

A tanpa B tidak membuktikan apa-apa; B tanpa A tidak bisa jalan. A lebih dulu.

---

## 6. Success Criteria

- [ ] `npm run test:e2e` menjalankan Playwright terhadap server + Postgres sungguhan
- [ ] Alur quick-add → Today → selesai hijau
- [ ] Alur offline → antre → sync hijau
- [ ] `npm run verify` **tidak** ikut menjalankan e2e dan tidak melambat
- [ ] Tes bisa dijalankan dua kali berturut-turut tanpa membersihkan manual
- [ ] Gagal menghasilkan jejak yang bisa dibuka (`trace: 'on-first-retry'`)
- [ ] README menjelaskan apa yang harus hidup sebelum menjalankannya
