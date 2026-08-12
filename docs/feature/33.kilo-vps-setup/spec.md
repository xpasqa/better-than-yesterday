# Spec: Claude Code Agent di VPS Produksi (Publion)

## Konteks

VPS Publion (2 vCPU, 4 GB RAM, 60 GB storage) sudah menjalankan proyek produksi
lain (Docker + Caddy + Next.js, traffic rendah). Kita ingin menjalankan
**Claude Code CLI** — pakai langganan Pro/Max yang sudah ada (login lewat
`claude login`, browser OAuth, bukan API key berbayar per-token) — dalam mode
full-auto (`--dangerously-skip-permissions`) di VPS yang sama, untuk
mengerjakan repo **ini sendiri** (`better-than-yesterday`,
`github.com/xpasqa/better-than-yesterday`), dikontrol dari iPhone lewat
Termius (SSH).

Alasan: pemilik VPS pergi liburan 4 hari dan ingin coding tetap jalan lewat
HP selama itu. `better-than-yesterday` adalah proyek terpisah dari produksi
yang sudah live di VPS — bukan produksi itu sendiri, jadi tetap harus
diisolasi dari produksi sesuai batasan di bawah, tapi ia sendiri boleh
di-clone dan dikerjakan penuh oleh agent.

### Tugas agent selama 4 hari

Bukan instruksi spesifik satu fitur — agent melanjutkan backlog yang sudah
ada di `docs/feature/*/todo.md` milik repo ini (checkbox yang belum
tercentang), diprioritaskan sesuai urutan nomor feature. Untuk folder feature
yang punya `spec.md`/`plan.md` tapi belum ada `todo.md`
(`2.backend`, `3.agent-file-panel`, `3.storage`), agent harus membaca spec
dan plan tersebut, cek progres riil di kode, lalu buat `todo.md` sebelum
mulai mengerjakan — mengikuti konvensi di `CLAUDE.md` repo ini.

### Commit langsung ke `master`

Diputuskan secara eksplisit oleh pemilik proyek: agent commit & push
langsung ke `master`, tanpa branch/PR review terpisah, meski itu berarti
tidak ada jaring pengaman review manusia sebelum kode masuk selama 4 hari.
Trade-off ini disadari dan diterima — bukan default yang direkomendasikan.

> Rencana ini awalnya ditulis untuk Kilo Code CLI (`kilo --auto`). Alat
> penggantinya Claude Code CLI, tapi profil risikonya identik:
> `--dangerously-skip-permissions` mematikan semua prompt konfirmasi sama
> seperti `kilo --auto`, jadi seluruh mitigasi isolasi di bawah tetap wajib
> apa adanya.

Detail stack produksi (database, volume, jumlah container, pemakaian RAM
aktual) belum diverifikasi — harus dicek langsung di server sebelum eksekusi.

## Batasan yang disepakati

- Tetap pakai VPS yang ada (tidak upgrade RAM, tidak sewa VPS kedua).
- Proyek produksi tidak boleh tersentuh oleh agent, dalam kondisi apa pun.
- Tidak ada langkah yang menyentuh produksi tanpa konfirmasi eksplisit dari
  pemilik VPS terlebih dahulu.
- Autentikasi Claude Code pakai langganan Pro/Max (OAuth), bukan API key —
  kredensial OAuth ini pun tunduk pada aturan yang sama: tidak boleh dibaca
  atau diakses selain oleh user agent yang login.

## Dua risiko utama

1. **Agent merusak produksi** — `--dangerously-skip-permissions` menonaktifkan
   semua prompt konfirmasi, sehingga agent bisa menjalankan operasi destruktif
   tanpa bertanya. Mitigasi: isolasi lewat user Linux + file permission (bukan
   sekadar pemisahan folder), dan **tidak pernah** memasukkan user agent ke
   grup `docker` (grup itu setara akses root penuh).
2. **OOM killer membunuh produksi** — di RAM 4 GB, beban gabungan produksi +
   agent + dev server proyek baru bisa melebihi kapasitas saat build. Tanpa
   mitigasi, kernel bisa membunuh proses produksi. Mitigasi: swap, cgroup
   memory limit untuk user agent, `oom_score_adj` untuk container produksi.

## Yang tetap tidak terlindungi

Agent tetap punya akses internet dan bisa membaca kredensial apa pun yang ada
di sesinya sendiri (termasuk token OAuth Claude Code). Kredensial produksi
tidak boleh disimpan di lokasi mana pun yang bisa dibaca user agent.

## Kriteria sukses (lihat todo.md untuk checklist verifikasi lengkap)

- User agent (`claude`) tidak bisa mengakses folder produksi
  (`Permission denied`).
- User agent tidak ada di grup `docker` dan tidak bisa `sudo`.
- Swap aktif, cgroup memory limit terpasang.
- Produksi tetap hidup dan melayani request setelah semua perubahan.

## Blocker

**Backup VPS ke lokal belum dibuat.** Pemilik VPS memilih backup lokal
sebagai pengganti snapshot panel provider Publion. Ini harus dilakukan
manual sebelum eksekusi step apa pun dari plan.md dimulai — lihat todo.md
item #1. Catatan: rollback dari backup lokal lebih lambat daripada
snapshot one-click provider (perlu restore manual), jadi pastikan cakupannya
lengkap (volume Docker + config produksi) sebelum lanjut.
