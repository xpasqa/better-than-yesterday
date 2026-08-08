# 1. Engineering Policy

Aturan kerja untuk project ini. Berlaku untuk semua kode, semua PR, semua sesi agent.
Kalau ada keputusan yang bertentangan dengan dokumen ini, dokumen ini yang menang —
kecuali kamu mengubah dokumennya dulu.

Tiga kata: **bersih, cepat, sederhana.** Urutannya penting. Kalau harus memilih,
sederhana mengalahkan cepat, dan cepat mengalahkan pintar.

Dokumen ini mengatur *bagaimana menulis kode*. Untuk *kapan kode boleh mulai
ditulis dan kapan boleh disebut selesai*, lihat
[2-workflow.md](2-workflow.md) — sama mengikatnya.

---

## 1. YAGNI, dan artinya apa

Bangun yang dibutuhkan hari ini. Bukan yang mungkin dibutuhkan bulan depan.

- **Jangan bikin abstraksi sebelum pemakaian ketiga.** Dua tempat yang mirip itu
  kebetulan. Tiga baru pola.
- **Jangan bikin opsi/flag/config untuk kasus yang belum ada.** Satu pengguna, satu
  cara pakai. Tambahkan kalau kasusnya muncul beneran.
- **Jangan tulis kode untuk skenario yang tidak bisa terjadi.** Ini single-user.
  Tidak ada balapan antar-orang, tidak ada permission, tidak ada tenant.
- **Jangan bikin lapisan yang cuma meneruskan.** Repository yang isinya `return
  db.select()` itu bukan abstraksi, itu ongkos.
- Kalau menemukan `TODO: nanti kalau...` — hapus. Tulis ulang saat "nanti" tiba.

## 2. Yang dilarang kecuali ada bukti butuh

Daftar ini bukan selera. Semuanya pernah kelihatan wajar dan semuanya mahal.
Boleh dilanggar, tapi harus ada alasan tertulis di PR.

| Dilarang | Kenapa | Pakai ini |
|---|---|---|
| Redis / message broker | Satu user. Antrean muat di Postgres | `pg-boss`, atau tidak sama sekali |
| CRDT / Yjs / operational transform | Konflik cuma antar-device sendiri | LWW per baris |
| GraphQL / tRPC / REST CRUD lengkap | Satu endpoint sudah cukup | `POST /sync` |
| Redux / Zustand / MobX | State-nya satu pohon | Store sendiri di atas Dexie |
| Microservice, queue service, worker terpisah | Satu proses cukup | Satu app |
| ORM dengan lazy loading & relasi ajaib | Query jadi tidak terbaca | Drizzle, SQL kelihatan |
| Turborepo / Nx / bundler config custom | Dua paket saja | npm workspaces + Vite |
| Barrel file (`index.ts` yang re-export) | Menyamarkan dependensi, merusak tree-shaking | Import langsung dari file |
| `any`, `as unknown as`, `@ts-ignore` | Menyembunyikan bug ke runtime | Perbaiki tipenya |
| Test yang me-mock database | Menguji mock, bukan kode | Uji `core/` (murni) atau pakai Postgres beneran |

## 3. Inti murni, tepi tipis

Ini aturan struktural terpenting di project ini.

- **`packages/core` tidak boleh punya I/O.** Tanpa `fetch`, tanpa `db`, tanpa
  `localStorage`, tanpa `Date.now()` yang tersembunyi (waktu dioper sebagai argumen).
  Fungsi murni: input → output.
- **Semua logika menarik tinggal di `core`.** Aturan pohon, urutan, filter view,
  parser. Kalau ada `if` yang menyatakan aturan bisnis di komponen React atau di
  route handler, itu salah tempat.
- **Web dan API tipis.** Tugasnya: ambil input, panggil `core`, simpan/tampilkan
  hasilnya. Tidak memutuskan apa pun.

Ujinya sederhana: kalau sebuah aturan tidak bisa diuji tanpa menyalakan browser
atau database, aturan itu ada di tempat yang salah.

## 4. Ukuran & bentuk file

- **File > 300 baris = sinyal.** Bukan larangan, tapi harus bisa dijelaskan.
  `MainContent.tsx` sekarang 490 baris karena memegang tiga tanggung jawab — itu
  contoh yang mau kita hindari, bukan ditiru.
- **Satu file, satu maksud.** Kalau menjelaskan isinya butuh kata "dan", pecah.
- **Fungsi muat di satu layar.** Kalau harus scroll untuk melihat seluruh alurnya,
  kamu tidak bisa memastikannya benar.
- Nama menjelaskan maksud, bukan tipe. `moveNode` bukan `nodeHandler`.

## 5. Anggaran performa

Angka, bukan perasaan. Kalau terlampaui, itu bug — bukan "nanti dioptimasi".

| Hal | Batas |
|---|---|
| Ketuk tombol → UI berubah | **< 16 ms**, dan tanpa menyentuh jaringan |
| Buka aplikasi → pohon tampil | **< 300 ms** dari Dexie (bukan dari server) |
| Bundle JS awal | **< 200 KB** gzip |
| Dependency baru | Harus disebut bobotnya di PR |

Aturan yang menopang semuanya: **jaringan tidak pernah ada di jalur render.**
Kalau ada komponen yang menunggu respons untuk menampilkan sesuatu, desainnya salah.

## 6. Dependency

- Setiap dependency baru butuh satu kalimat pembenaran di PR.
- Utility < 50 baris: tulis sendiri, jangan `npm install`.
- Lebih baik satu library yang dipahami penuh daripada tiga yang dipakai 5%-nya.
- Kalau library dipakai di satu tempat saja, bungkus di satu file supaya bisa dicabut.

## 7. Test

Uji yang bisa salah. Jangan uji yang cuma meneruskan.

- **`packages/core`: wajib diuji, dan cukup unit test.** Fungsi murni, jadi tidak
  ada alasan tidak diuji. Ini yang paling mungkin salah dan paling murah diuji:
  fractional index, indent/outdent, parser, filter view.
- **Sync: integration test dengan Postgres asli.** Skenario yang wajib ada:
  offline → online, dua device edit node yang sama, delete sambil offline.
- **Komponen React: jangan diuji satu per satu.** Ganti dengan satu-dua alur E2E
  (Playwright) untuk jalur yang beneran kamu pakai tiap hari: quick capture → muncul
  di Today → dicentang.
- Test yang gagal acak langsung dihapus atau diperbaiki hari itu juga. Test tidak
  stabil lebih buruk daripada tidak ada test.

## 8. Komentar & dokumentasi

- Komentar menjelaskan **kenapa**, bukan **apa**. Kode sudah bilang apa.
- Jangan tulis komentar yang mengulang nama fungsi.
- Keputusan arsitektur yang punya alternatif serius → tulis di `docs/superpowers/specs/`,
  bukan di komentar kode.
- Kode mati dihapus, bukan dikomentari. Git yang mengingat.

## 9. Yang boleh melanggar dokumen ini

Boleh, dengan syarat: sebutkan aturan mana yang dilanggar dan kenapa, di deskripsi PR
atau di komentar tepat di atas kodenya. Pelanggaran yang disadari itu keputusan teknis.
Pelanggaran diam-diam itu utang.
