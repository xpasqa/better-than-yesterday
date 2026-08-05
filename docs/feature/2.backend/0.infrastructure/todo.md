# Todo: Infrastruktur & Boilerplate

Urutan eksekusi [spec.md](spec.md). Tiap blok berakhir dengan verifikasi;
tidak lanjut ke blok berikutnya sebelum verifikasinya hijau
(`npm run verify` adalah gate di setiap commit).

## A. Monorepo & workspace

- [ ] Restrukturisasi ke npm workspaces: `packages/core`, `apps/web`, `apps/api`
      — `src/` sekarang pindah utuh ke `apps/web/src` (import path dicek, CSS
      tidak disentuh)
- [ ] Root `package.json`: workspaces + script `dev` (web+api paralel),
      `verify`, `test`
- [ ] `tsconfig` dasar per workspace; `strict: true`; tanpa path alias ajaib
- [ ] oxlint jalan di ketiga workspace
- [ ] **Verifikasi:** `npm run dev` → app frontend jalan persis seperti
      sebelumnya di :4200; `npm run verify` hijau

## B. packages/core kerangka

- [ ] `core/id.ts` — `uuidv7()` + tes (format, monotonik dalam satu ms)
- [ ] `core/date.ts` — `localToday(now: Date): string` + tes (dibanding
      perilaku UTC yang salah)
- [ ] **Verifikasi:** `npm test` hijau; tidak ada I/O apa pun di `core`
      (grep `fetch|localStorage|Date.now` di source non-tes)

## C. apps/api kerangka

- [ ] `config.ts` — Zod parse env; mati saat start jika kurang, menyebut nama
      variabel; tidak ada `process.env` di file lain
- [ ] `http/errors.ts` — `AppError(code, status, message, details?)` +
      `errorHandler` → envelope `{ error: { code, message, details } }`
- [ ] `http/request-log.ts` — satu baris per request: method, path, status, ms
- [ ] `app.ts` — urutan middleware: request-log → errorHandler → publik →
      auth-middleware → route; body limit 1 MB
- [ ] `index.ts` — bootstrap + graceful shutdown (SIGTERM: server lalu pool)
- [ ] `GET /health` → `{ ok: true }` + `SELECT 1`
- [ ] **Verifikasi:** api hidup di :3001; `/health` 200; route tak dikenal →
      404 envelope; error dilempar → 500 envelope tanpa stack

## D. Database & user

- [ ] `db/client.ts` — pool pg + drizzle; `docker-compose.yml` service
      `postgres:16` + volume
- [ ] `db/schema/user.ts` — tabel `app_user` sesuai spec §4.1
- [ ] drizzle-kit generate + migrate jalan; migrasi juga dijalankan otomatis
      saat start api sebelum listen
- [ ] `scripts/user.ts` — `add` (prompt password, transaksional, siap dititipi
      seed per-user fase 1), `set-password`, `list`
- [ ] **Verifikasi:** `user add` × 2 akun; `user list` menampilkan keduanya;
      `add` email duplikat gagal dengan pesan jelas; hash argon2id di DB,
      bukan plaintext

## E. Auth

- [ ] `modules/auth/session.ts` — sign/verify cookie HMAC-SHA256
      `{ userId, exp }`, 30 hari sliding + tes unit (expiry, tamper)
- [ ] `modules/auth/rate-limit.ts` — 5 / 15 menit per email+IP, in-memory
- [ ] `modules/auth/routes.ts` — `POST /auth/login` (error identik untuk email
      vs password salah), `POST /auth/logout`, `GET /auth/me`
- [ ] `http/auth-middleware.ts` — cookie valid → `c.set('userId')`; selain itu
      401 envelope
- [ ] **Verifikasi (tes integrasi lawan Postgres asli):** login/me/logout;
      percobaan ke-6 → 429; cookie dimodifikasi → 401; hash tidak muncul di
      response/log

## F. Tes isolasi (kerangka)

- [ ] `test/isolation.test.ts` — dua user, sesi A tidak bisa membaca/menulis
      milik B, respons 404 bukan 403; di fase 0 berisi kerangka + kasus
      `/auth/me`; **setiap fase berikutnya wajib menambah kasusnya di file ini**
- [ ] **Verifikasi:** `npm test` hijau termasuk isolasi

## G. Deploy

- [ ] `Dockerfile` api multi-stage; `docker-compose.yml` lengkap: api +
      postgres + caddy
- [ ] `Caddyfile` — serve `apps/web/dist`, proxy `/api` → `api:3001`, HTTPS
- [ ] `.env.example` — `DATABASE_URL`, `SESSION_SECRET`,
      `APP_ENCRYPTION_KEY` (nama saja)
- [ ] Deploy ke VPS; `user add` × 3 akun asli (owner, istri, teman)
- [ ] Cron backup `pg_dump` di host + catatan cara restore ke scratch
- [ ] **Verifikasi:** ketiga akun login dari browser HP via HTTPS; restart
      container → sesi tetap hidup; `docker compose down && up` → data utuh

## Definisi selesai fase 0

Semua Success Criteria di [spec.md §9](spec.md) tercentang, dan repo siap
menerima fase 1 (Todo) hanya dengan menambah `db/schema/node.ts` +
`modules/sync/` + `apps/web/src/store/`.
