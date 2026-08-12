# Todo: Claude Code Agent di VPS Produksi

## Blocking — sebelum apa pun lainnya

- [ ] **Backup VPS ke lokal** (manual, oleh pemilik VPS — dipilih menggantikan
      snapshot panel provider Publion; pastikan mencakup minimal: volume
      Docker produksi + `docker-compose.yml`/`Caddyfile` produksi)
- [ ] Pastikan kode produksi sudah ter-push ke remote git
- [ ] Sediakan akses SSH (key-based) untuk agent yang akan eksekusi sisa plan

## Fase 1 — Audit

- [ ] `docker ps`, `docker stats`, `free -h`, `swapon --show`
- [ ] Cari lokasi produksi (`docker-compose.y*ml`, `Caddyfile`)
- [ ] **Tampilkan hasil temuan lokasi produksi ke pemilik VPS, minta konfirmasi**
- [ ] Cek owner file/proses produksi (jangan asumsikan root)
- [ ] Cek apakah username `claude` sudah dipakai di VPS ini

## Fase 2 — Resource hardening

- [ ] Cek `swapon --show`, buat swap 4 GB jika belum ada
- [ ] Set `vm.swappiness=10`
- [ ] Tambahkan `mem_limit` + `oom_score_adj: -800` ke compose produksi
      (nilai dari `docker stats` riil, bukan estimasi)
- [ ] Redeploy produksi, verifikasi masih hidup

## Fase 3 — Isolasi user

- [ ] Buat user `claude` (tanpa sudo, tanpa grup `docker`)
- [ ] Kunci folder produksi sesuai owner asli (bukan asal `root:root`)
- [ ] Set cgroup memory limit untuk `user-$(id -u claude).slice`

## Fase 4 — Instalasi Claude Code CLI

- [ ] Install Node.js 20+, tmux, git, ripgrep
- [ ] `npm install -g @anthropic-ai/claude-code` sebagai user `claude`
- [ ] `claude login` (interaktif, OAuth Pro/Max — sekali saja, manual)
- [ ] Putuskan: proyek baru butuh Docker? Jika ya → Docker rootless untuk `claude`
- [ ] `.tmux.conf` untuk `claude`
- [ ] `NODE_OPTIONS=--max-old-space-size=1024` untuk dev server

## Fase 4.5 — Deploy repo `better-than-yesterday`

- [ ] `git clone https://github.com/xpasqa/better-than-yesterday.git ~/lab` (user `claude`)
- [ ] Install dependencies proyek
- [ ] Setup env var/secret milik proyek ini (bukan kredensial produksi VPS)
- [ ] Cek `git remote -v`, `git config user.email`/`user.name` di VPS
- [ ] Buat `todo.md` untuk feature yang belum punya (`2.backend`,
      `3.agent-file-panel`, `3.storage`) berdasarkan spec/plan + progres kode
      riil
- [ ] Briefing awal ke agent (interaktif, sekali, sebelum liburan mulai):
      lanjutkan backlog docs/feature/, commit+push langsung ke master

## Fase 5 — Akses iPhone

- [ ] Setup Termius (SSH key, snippet tmux, Keep Alive)
- [ ] Tentukan port dev server baru (cek `sudo ss -tlnp` dulu)
- [ ] (Opsional, manual oleh pemilik VPS) subdomain baru di Caddyfile

## Fase 6 — Verifikasi final (semua harus lolos)

- [ ] `sudo -u claude ls <PROD_DIR>` → Permission denied
- [ ] `groups claude` → tidak memuat "docker"
- [ ] `sudo -u claude sudo -n true` → ditolak
- [ ] `swapon --show` → swap aktif
- [ ] `systemctl show user-$(id -u claude).slice -p MemoryMax` → limit terpasang
- [ ] `docker ps` + `curl -I https://<domain-produksi>` → produksi masih hidup

Hanya setelah semua item Fase 6 lolos, `claude --dangerously-skip-permissions`
boleh dijalankan.
