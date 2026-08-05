# Todo: Infrastruktur & Boilerplate

Urutan eksekusi [spec.md](spec.md). Tiap blok berakhir dengan verifikasi;
tidak lanjut ke blok berikutnya sebelum verifikasinya hijau
(`npm run verify` adalah gate di setiap commit).

## A. Monorepo & workspace

- [x] Restrukturisasi ke npm workspaces: `packages/core`, `apps/web`, `apps/api`
      — `src/` sekarang pindah utuh ke `apps/web/src` (import path dicek, CSS
      tidak disentuh)
- [x] Root `package.json`: workspaces + script `dev` (web+api paralel),
      `verify`, `test`
- [x] `tsconfig` dasar per workspace; `strict: true`; tanpa path alias ajaib
- [x] oxlint jalan di ketiga workspace
- [x] **Verifikasi:** `npm run dev` → app frontend jalan persis seperti
      sebelumnya di :4200; `npm run verify` hijau

## B. packages/core kerangka

- [x] `core/id.ts` — `uuidv7()` + tes (format, monotonik dalam satu ms)
- [x] `core/date.ts` — `localToday(now: Date): string` + tes (dibanding
      perilaku UTC yang salah) — diberi nama `localDate`/`todayInTimezone`
      di implementasi karena menerima timezone eksplisit, bukan "lokal
      device"; lihat 1.todo/spec.md soal timezone di user
- [x] **Verifikasi:** `npm test` hijau; tidak ada I/O apa pun di `core`
      (grep `fetch|localStorage|Date.now` di source non-tes)

## C. apps/api kerangka

- [x] `config.ts` — Zod parse env; mati saat start jika kurang, menyebut nama
      variabel; tidak ada `process.env` di file lain
- [x] `http/errors.ts` — `AppError(code, status, message, details?)` +
      `errorHandler` → envelope `{ error: { code, message, details } }`
- [x] `http/request-log.ts` — satu baris per request: method, path, status, ms
- [x] `app.ts` — urutan middleware: request-log → errorHandler → publik →
      auth-middleware → route; body limit 1 MB
- [x] `index.ts` — bootstrap + graceful shutdown (SIGTERM: server lalu pool)
- [x] `GET /health` → `{ ok: true }` + `SELECT 1`
- [x] **Verifikasi:** api hidup di :3001; `/health` 200; route tak dikenal →
      404 envelope; error dilempar → 500 envelope tanpa stack

## D. Database & user

- [x] `db/client.ts` — pool pg + drizzle; `docker-compose.yml` service
      `postgres:16` + volume
- [x] `db/schema/user.ts` — tabel `app_user` sesuai spec §4.1
- [x] drizzle-kit generate + migrate jalan; migrasi juga dijalankan otomatis
      saat start api sebelum listen
- [x] `scripts/user.ts` — `add` (prompt password, transaksional, siap dititipi
      seed per-user fase 1), `set-password`, `list`
- [x] **Verifikasi:** `user add` × 2 akun; `user list` menampilkan keduanya;
      `add` email duplikat gagal dengan pesan jelas; hash argon2id di DB,
      bukan plaintext

## E. Auth

- [x] `modules/auth/session.ts` — sign/verify cookie HMAC-SHA256
      `{ userId, exp }`, 30 hari sliding + tes unit (expiry, tamper)
- [x] `modules/auth/rate-limit.ts` — 5 / 15 menit per email+IP, in-memory
- [x] `modules/auth/routes.ts` — `POST /auth/login` (error identik untuk email
      vs password salah), `POST /auth/logout`, `GET /auth/me`
- [x] `http/auth-middleware.ts` — cookie valid → `c.set('userId')`; selain itu
      401 envelope
- [x] **Verifikasi (tes integrasi lawan Postgres asli):** login/me/logout;
      percobaan ke-6 → 429; cookie dimodifikasi → 401; hash tidak muncul di
      response/log

## F. Tes isolasi (kerangka)

- [x] `test/isolation.test.ts` — dua user, sesi A tidak bisa membaca/menulis
      milik B, respons 404 bukan 403; di fase 0 berisi kerangka + kasus
      `/auth/me`; **setiap fase berikutnya wajib menambah kasusnya di file ini**
      — fase 1 sudah menambah kasus node/sync di file yang sama
- [x] **Verifikasi:** `npm test` hijau termasuk isolasi

## G. Deploy

- [x] `Dockerfile` api multi-stage; `docker-compose.yml` lengkap: api +
      postgres + caddy
- [x] `Caddyfile` — serve `apps/web/dist`, proxy `/health`, `/auth/*`, `/api/*`
      → `api:3001`, HTTPS otomatis lewat `SITE_ADDRESS`
- [x] `.env.example` — `DATABASE_URL`, `SESSION_SECRET`,
      `APP_ENCRYPTION_KEY`, `POSTGRES_PASSWORD`, `SITE_ADDRESS` (nama saja)
- [ ] Deploy ke VPS; `user add` × 3 akun asli (owner, istri, teman) — **belum
      ada VPS**; tiga akun *test* sudah dibuat secara lokal untuk verifikasi
- [ ] Cron backup `pg_dump` di host + catatan cara restore ke scratch —
      menunggu VPS
- [ ] **Verifikasi:** ketiga akun login dari browser HP via HTTPS; restart
      container → sesi tetap hidup; `docker compose down && up` → data utuh
      — **sebagian terverifikasi**: `docker compose up -d postgres` jalan dan
      sehat di lingkungan build ini; image `api`/`caddy` belum sempat
      di-build+jalankan penuh di sini (registry Docker tidak terjangkau dari
      sandbox pengembangan ini — lihat catatan di laporan akhir). Kesetaraan
      perilaku `Dockerfile`-nya sudah diverifikasi via perintah host yang
      sama persis (`npm ci`, `npm run build`, `npm start`, termasuk binding
      native argon2) — build sesungguhnya perlu dicoba di mesin dengan akses
      registry (mis. VPS tujuan) sebelum dianggap final

## Definisi selesai fase 0

Semua Success Criteria di [spec.md §9](spec.md) tercentang **kecuali** yang
menyebut VPS sungguhan (belum ada). Repo sudah siap menerima fase 1 (Todo) —
dan fase 1 sudah dieksekusi sebagian: `db/schema/node.ts`, `modules/sync/`,
dan `apps/web/src/store/` semuanya sudah ada. Lihat
[1.todo/todo.md](../1.todo/todo.md) untuk rincian.
