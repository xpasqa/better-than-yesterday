# Plan: Claude Code Agent di VPS Produksi

Eksekusi hanya boleh dimulai setelah akses SSH ke VPS tersedia dan snapshot
sudah dikonfirmasi (lihat todo.md #1–2). Setiap langkah yang menyentuh
produksi butuh konfirmasi eksplisit di chat sebelum dijalankan.

User Linux untuk agent disebut `claude` di seluruh dokumen ini (ganti kalau
username itu bentrok dengan sesuatu yang sudah ada di VPS — cek di Fase 1).

## Fase 0 — Prasyarat (blocking)

- Backup VPS ke lokal (manual, oleh pemilik VPS — dipilih menggantikan
  snapshot panel provider Publion). Minimal cakup: volume Docker produksi,
  `docker-compose.yml` produksi, `Caddyfile` produksi. Rollback-nya jadi
  restore manual, bukan one-click seperti snapshot provider — lebih lambat
  kalau terjadi insiden, tapi sudah cukup sebagai jaring pengaman sebelum
  eksekusi dimulai.
- Pastikan kode produksi sudah ter-push ke remote git.
- Sediakan akses SSH (key-based, bukan password) untuk eksekusi langkah
  selanjutnya.

## Fase 1 — Audit (read-only, aman dijalankan tanpa konfirmasi tambahan)

- `docker ps`, `docker stats`, `free -h`, `swapon --show`
- Cari lokasi produksi: cari `docker-compose.y*ml` dan/atau `Caddyfile`
  (exclude `node_modules`, `/proc`, `/sys`) → **tampilkan hasil temuan dan
  minta konfirmasi eksplisit sebelum melanjutkan ke Fase 2.**
- Cek owner file/proses produksi saat ini (jangan asumsikan root).
- Cek apakah username `claude` sudah dipakai di VPS ini.

## Fase 2 — Resource hardening (butuh konfirmasi sebelum eksekusi)

- Buat swap 4 GB jika belum ada (`swapon --show` dulu).
- Set `vm.swappiness=10`.
- Tambahkan `mem_limit` + `oom_score_adj: -800` ke `docker-compose.yml`
  produksi (nilai `mem_limit` disesuaikan dengan `docker stats` riil), lalu
  redeploy.

## Fase 3 — Isolasi user (butuh konfirmasi sebelum eksekusi)

- Buat user `claude` tanpa sudo, tanpa grup `docker`.
- Kunci folder produksi (chown/chmod ke owner yang sesuai — verifikasi owner
  asli dulu, jangan asal `root:root`).
- Set cgroup memory limit untuk `user-$(id -u claude).slice`
  (`MemoryMax=1800M MemoryHigh=1500M`, sesuaikan dengan angka riil dari Fase
  1).

## Fase 4 — Instalasi & konfigurasi Claude Code CLI

- Install Node.js 20+, tmux, git, ripgrep.
- Install Claude Code CLI sebagai user `claude`:
  `npm install -g @anthropic-ai/claude-code`.
- Login dengan langganan Pro/Max: `claude login` sebagai user `claude` —
  ini butuh interaksi (buka link OAuth di browser manapun, lalu paste kode
  balik ke terminal SSH). Harus dilakukan sekali secara manual/interaktif,
  bukan headless.
- (Kondisional) Docker rootless untuk `claude` jika proyek baru butuh Docker
  — lihat spec.md "Yang Perlu Ditentukan".
- `.tmux.conf` untuk `claude` (`mouse on`, `history-limit 20000`).
- `NODE_OPTIONS=--max-old-space-size=1024` untuk dev server proyek baru.

## Fase 4.5 — Deploy repo `better-than-yesterday` ke VPS

- Sebagai user `claude`: `git clone https://github.com/xpasqa/better-than-yesterday.git ~/lab`
- Install dependencies proyek (`npm install`/`pnpm install` sesuai
  package manager yang dipakai repo — cek `package.json`/lockfile).
- Setup env var/secret yang dibutuhkan proyek ini (Caddy, DB lokal, dsb) —
  **jangan pernah** menaruh kredensial produksi VPS di sini, hanya
  kredensial milik proyek `better-than-yesterday` sendiri.
- Konfirmasi `git remote -v` dan `git config user.email`/`user.name` di VPS
  sudah benar sebelum agent mulai commit.
- Briefing awal untuk agent (dijalankan sekali secara interaktif sebelum
  liburan mulai): minta lanjutkan backlog `docs/feature/*/todo.md`, commit
  & push langsung ke `master` sesering mungkin per unit kerja selesai (lihat
  spec.md "Tugas agent selama 4 hari").

## Fase 5 — Akses dari iPhone

- Setup Termius: SSH key, snippet
  `tmux attach -t claude || tmux new -s claude`, Keep Alive.
- Dev server proyek baru di port tinggi (cek `sudo ss -tlnp` dulu, contoh:
  3100). Tidak expose ke internet — akses lewat SSH port-forward, atau
  subdomain baru yang ditambahkan manual oleh pemilik VPS ke Caddyfile
  (bukan oleh agent).

## Fase 6 — Verifikasi (wajib lolos semua sebelum mode full-auto dijalankan)

Lihat todo.md untuk checklist lengkap — enam pengecekan dari briefing asli:
akses produksi ditolak untuk `claude`, tidak di grup docker, tidak bisa sudo,
swap aktif, cgroup terpasang, produksi masih melayani request.

Setelah lolos: `sudo -iu claude`, `cd ~/lab`, `tmux new -s claude`,
`claude --dangerously-skip-permissions`.

## Hal yang sengaja dibiarkan terbuka (putuskan setelah audit Fase 1)

- Apakah proyek baru butuh Docker (→ Docker rootless atau tidak).
- Angka `mem_limit`/cgroup final (dari data riil, bukan estimasi tabel di
  spec.md).
- Runtime tambahan (Python, Go, dll) sesuai kebutuhan proyek baru.
