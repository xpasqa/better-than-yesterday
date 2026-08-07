# Todo: Environment Setup & Production Deployment

**Ditulis 2026-08-07 (issue #22)** — `spec.md` sudah ada tanpa `plan.md`/
`todo.md` (melanggar konvensi CLAUDE.md). Diaudit terhadap kode & server
aktual: hampir seluruh scope spec ini sudah selesai, jadi todo ini ditulis
sebagai catatan status, bukan rencana ke depan.

## Tier 1 — wajib (spec.md §7)

- [x] `npm install` jalan tanpa `sudo` — `node_modules` (root, `apps/api`,
      `apps/web`) semua milik `ubuntu`, bukan `root`
- [x] Package `openai`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
      terpasang (`apps/api/package.json`)
- [x] Type shims (`openai-shim.d.ts`, `aws-shim.d.ts`) sudah tidak ada
- [x] `npm run typecheck` — bersih di seluruh workspace
- [x] `npm run lint` — bersih
- [x] `npm run db:migrate -w @better/api` — no-op bersih di production
      (issue #17 memperbaiki drift journal yang sebelumnya bikin ini berisiko)
- [x] `GET /health` → `{"ok":true}` — diverifikasi lewat container produksi
      di `127.0.0.1:3101` (host `127.0.0.1:3001` dipakai proyek lain yang
      berbagi VPS ini, `publion-app` — bukan masalah di app ini)
- [x] `npm run test -w @better/api` — 40/40 pass (issue #19 menambah
      `postgres-test` container yang sebelumnya tidak ada sama sekali)

## Tier 2 — verifikasi fitur baru (spec.md §7)

**Belum diverifikasi** — butuh API key AI nyata dan kredensial S3 nyata,
keduanya di luar scope audit ini.

- [ ] Set API key di UI Agent → kirim pesan → SSE token mengalir → jawaban
      muncul di chat
- [ ] Agent membuat file → muncul di file panel
- [ ] "New task" mereset semua state
- [ ] Storage: presign → PUT → confirm (blocked, issue #14)

## Tier 3 — regresi (spec.md §7)

- [x] Todo sync — `test/sync.test.ts` 12/12 pass
- [x] Isolasi antar-user — `test/isolation.test.ts` 7/7 pass
- [x] Login/logout — `test/auth.test.ts` 8/8 pass
- [ ] **Belum diverifikasi di browser sungguhan** — tidak ada tooling
      browser tersedia di sesi audit ini (Chrome extension tidak terhubung,
      tidak ada Playwright/headless browser terpasang); Outline/todo UI
      tidak dicek visual, hanya lewat typecheck + test otomatis

## Status

Tier 1 selesai. Tier 2 diblokir kredensial eksternal (sama seperti issue
#14). Tier 3 hijau di level test otomatis; verifikasi visual manual di
browser masih perlu dilakukan sebelum menganggap fase ini 100% tuntas.
