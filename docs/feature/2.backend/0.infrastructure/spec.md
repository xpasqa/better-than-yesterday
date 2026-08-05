# Spec: Infrastruktur & Boilerplate

> Fondasi yang dipakai semua backend: monorepo, API Hono, Postgres, auth
> multi-user kecil, error envelope, deploy. Selesai berarti app kosong yang
> sehat — bukan fitur.

**Status:** v1 · **Fase:** 0 · **Bergantung pada:**
[spec induk](../spec.md), [Engineering Policy](../../../policy/1-engineering-policy.md)

---

## 1. Objective

Depan **React** (SPA Vite yang sudah ada — tidak ditulis ulang), belakang
**Node.js** (Hono). Fase ini membangun kerangka yang membuat lima backend
berikutnya (Todo, Outline, Storage, Agent, Mail) tinggal **menambah** satu
folder module dan satu file schema — tanpa pernah mengubah bentuk dasarnya.

**Multi-user sejak migrasi pertama**, tapi kecil dan tertutup: owner, istri,
teman — ±3 akun, dibuat lewat CLI di server, **tanpa halaman sign-up publik**.
Data antar-user terisolasi penuh: istri tidak pernah melihat task, file, chat,
atau mail milik owner, dan sebaliknya.

---

## 2. Scope

**In:** struktur monorepo · `packages/core` kosong tapi ber-bentuk ·
`apps/api` dengan config, error envelope, logging, health · tabel `app_user` +
sesi · login/logout · CLI tambah user · aturan scoping `user_id` · seed per
user · docker compose + Caddy + deploy VPS · gate `npm run verify` · tes
isolasi antar-user.

**Out:** semua fitur domain (fase 1–5) · sign-up publik · reset password via
email (CLI menggantikannya) · OAuth/2FA · roles/admin panel · workspace
bersama antar user (data sepenuhnya per-user di v1; kolaborasi = keputusan
nanti) · RLS Postgres (lihat §5) · rate limit selain login.

---

## 3. Struktur Folder (boilerplate)

Monorepo npm workspaces, tanpa Turborepo/Nx (policy §2):

```
better/
├── docs/
├── packages/
│   └── core/                        # murni, tanpa I/O (policy §3)
│       └── src/
│           ├── id.ts                # uuidv7()
│           ├── date.ts              # localToday(now)
│           └── *.test.ts            # tes di sebelah subjek
│
├── apps/
│   ├── web/                         # src/ sekarang, dipindah utuh
│   │   └── src/store/               # (fase 1) Dexie + outbox + sync client
│   │
│   └── api/
│       ├── src/
│       │   ├── index.ts             # bootstrap: config → db → migrate → app → listen
│       │   │                        # + graceful shutdown (SIGTERM: tutup server, pool)
│       │   ├── app.ts               # rakitan Hono: urutan middleware + mount module
│       │   ├── config.ts            # parse env dengan Zod SEKALI; gagal = mati saat start
│       │   │                        # tidak ada process.env di luar file ini
│       │   ├── http/
│       │   │   ├── errors.ts        # AppError + errorHandler → envelope §6
│       │   │   ├── auth-middleware.ts   # verifikasi cookie → c.set('userId')
│       │   │   └── request-log.ts   # satu baris per request: method path status ms
│       │   ├── db/
│       │   │   ├── client.ts        # pool pg + drizzle
│       │   │   └── schema/
│       │   │       └── user.ts      # fase ini; fase depan menambah file, bukan mengubah
│       │   └── modules/
│       │       └── auth/
│       │           ├── routes.ts    # POST /auth/login /auth/logout, GET /auth/me
│       │           ├── session.ts   # sign/verify cookie HMAC
│       │           └── rate-limit.ts
│       ├── drizzle/                 # hasil generate — tidak diedit tangan
│       └── test/                    # integrasi lawan Postgres asli
│
├── scripts/
│   └── user.ts                      # add/set-password/list — manajemen akun via CLI
├── docker-compose.yml               # api + postgres + caddy
├── Caddyfile                        # serve apps/web/dist + proxy /api → api:3001
└── .env.example                     # nama variabel saja
```

Aturan bentuk (policy §1 §4): tanpa barrel file; tanpa folder
`services/`/`repositories/`/`controllers/` — route handler memvalidasi →
memanggil query/`core` → membentuk response; satu module = `routes.ts` + file
yang benar-benar punya logika; `apps/api` tak pernah import dari `apps/web`;
keduanya boleh import `packages/core`.

### Urutan middleware (`app.ts`)

```
request-log → errorHandler → [publik: GET /health, POST /auth/login]
            → auth-middleware → semua route lain
```

- `GET /health` → `{ ok: true }` + `SELECT 1`; dipakai healthcheck compose.
- Tanpa CORS: Caddy menyajikan web dan mem-proxy `/api` di origin yang sama.
- Body limit global 1 MB (file besar tidak pernah lewat API — itu urusan
  presigned URL di fase Storage).

---

## 4. Multi-User

### 4.1 Tabel (schema/user.ts)

```sql
CREATE TABLE app_user (
  id            TEXT PRIMARY KEY,              -- UUIDv7
  email         TEXT NOT NULL UNIQUE,          -- disimpan lowercase
  name          TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,                 -- argon2id
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Tanpa kolom `role`. Tiga akun setara dan saling terisolasi; "admin" adalah
siapa pun yang bisa SSH ke VPS dan menjalankan CLI. Kolom role menjadi perlu
saat ada fitur yang membedakan user — belum ada (policy §1).

### 4.2 Manajemen akun: CLI, bukan halaman

```bash
npm run user -- add pasqa@example.com "Pasqa"        # prompt password; buat akun + seed miliknya
npm run user -- set-password pasqa@example.com       # jalur reset password
npm run user -- list
```

Sign-up publik pada app 3-orang adalah undangan masuk, dan membangunnya
berharga satu halaman + satu rate limiter + satu feature flag untuk menjaganya
tetap tertutup. Reset password = suami/istri/teman minta ke owner →
satu perintah CLI. `add` bersifat transaksional: baris user **plus seed
miliknya** (fase 1 menambahkan root Inbox per user di sini).

### 4.3 Aturan scoping — disiplin inti seluruh backend

**Setiap tabel domain (fase 1–5) wajib membawa
`user_id TEXT NOT NULL REFERENCES app_user(id)` + index, sejak migrasi
pertamanya.** Setiap query di setiap module difilter `WHERE user_id = ?` dari
sesi — tidak pernah dari body request.

```ts
// pola kanonik setiap route handler
const userId = c.get('userId')            // dari auth-middleware; 401 jika absen
const parsed = schema.safeParse(await c.req.json())   // body bertipe unknown
if (!parsed.success) throw new AppError('VALIDATION_ERROR', 422, …)
// … query SELALU menyertakan user_id = userId
```

Rancangan sebelumnya menulis kolom tenancy tanpa pernah membacanya, karena
multi-user belum nyata. Di sini multi-user **nyata sejak hari pertama**, jadi
kolomnya ditulis DAN dibaca — kolom yang ditulis tapi diabaikan hanya
memberi rasa aman palsu. **RLS Postgres tetap ditunda**:
tiga user yang saling percaya di satu app; `WHERE` + tes isolasi §8 adalah
pagarnya; RLS jadi hardening satu migrasi nanti karena kolomnya sudah ada dan
terisi — bagian yang mahal sudah dibayar.

### 4.4 Konsekuensi ke fase lain (dicatat di sini, dieksekusi di sana)

| Fase | Konsekuensi multi-user |
|---|---|
| 1 Todo | `node.user_id`; sync cursor per user (`WHERE user_id = ? AND seq > ?`); satu root Inbox per user, dibuat oleh `user add` |
| 3 Storage | Kuota & prefix key per user (`storage/{user_id}/…`) |
| 4 Agent | Provider/model/key per user di Settings → tabel `user_settings`, key terenkripsi di aplikasi (bukan env global — koreksi atas keputusan env di spec induk §3.3, karena kini ada 3 pemilik key) |
| 5 Mail | Kredensial IMAP per user → baris per user, terenkripsi; bukan env global |

---

## 5. Auth

- **argon2id** (cost default library, diverifikasi < 500 ms di VPS).
- Sesi = cookie `httpOnly` `secure` `sameSite=lax`, payload
  `{ userId, exp }` ditandatangani HMAC-SHA256 `SESSION_SECRET`, umur 30 hari
  sliding, tanpa tabel sesi. Logout = hapus cookie. (Revokasi paksa = ganti
  `SESSION_SECRET`, mengeluarkan semua orang — dapat diterima di 3 user.)
- `POST /auth/login` `{ email, password }` → set cookie, `{ user: { id,
  email, name } }`. Email dan password salah → error identik, waktu
  sebanding — tanpa enumerasi.
- `GET /auth/me` → user aktif; dipakai web saat boot.
- Rate limit login: **5 percobaan / 15 menit per email+IP**, in-memory (satu
  instance = benar; instance kedua adalah sinyal pindah ke Postgres).
- Hash tidak pernah tampil di response, log, atau error.

---

## 6. Kontrak HTTP (berlaku untuk semua fase)

Satu bentuk error di mana-mana:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": {} } }
```

400 input rusak · 401 tanpa sesi · 404 bukan milikmu/tidak ada (dua-duanya
404 — 403 pada resource user lain membocorkan keberadaannya) · 409 konflik ·
422 validasi gagal · 429 rate limit · 500 tanpa detail internal, ber-log
lengkap di server.

Zod di setiap boundary; body bertipe `unknown` di-`safeParse` dulu. Response
pihak ketiga (nanti: openagentic, IMAP, iDrive) juga divalidasi bentuknya.
Field baru selalu aditif & opsional. Endpoint list selalu ber-batas
(`limit` + cursor) sejak hari pertama.

---

## 7. Config, Commands, Deploy

### Env (`.env.example` — nama saja)

```
DATABASE_URL=
SESSION_SECRET=          # ≥ 32 byte acak
APP_ENCRYPTION_KEY=      # AES-256-GCM untuk secret per-user (dipakai fase 4 & 5)
```

`config.ts` mem-parse env dengan Zod saat start; variabel hilang = proses mati
menyebut namanya. `APP_ENCRYPTION_KEY` disiapkan sekarang karena §4.4 sudah
memastikan dua fase membutuhkannya — menambah env di produksi belakangan lebih
mahal daripada satu baris sekarang.

### Commands

```bash
npm run dev            # web (:4200) + api (:3001) paralel
npm run verify         # typecheck && lint (oxlint) && test && build — gate sebelum commit
npm run db:generate    # drizzle-kit generate
npm run db:migrate
npm run user -- …      # §4.2
docker compose up -d postgres
```

### Deploy

- `docker compose`: `api` (image multi-stage: build → `node dist/index.js`;
  migrasi jalan saat start sebelum listen), `postgres:16` + volume bernama,
  `caddy` (serve `apps/web/dist`, proxy `/api`, HTTPS otomatis).
- Backup: cron host `pg_dump --format=custom | gzip`, 02:00, retensi 30
  harian — aktif **sejak fase 1** (begitu ada data asli); restore bulanan ke
  database scratch adalah bagian dari definisi "backup".

---

## 8. Testing

| Level | Alat | Cakupan fase ini |
|---|---|---|
| Unit | Vitest | `core/id.ts` (monotonik, format), `core/date.ts`, `session.ts` (sign/verify/expiry/tamper) |
| Integrasi | Vitest + Postgres asli (docker) | login/logout/me; rate limit percobaan ke-6; CLI `user add` transaksional + idempoten-gagal-jelas; **tes isolasi** |
| E2E | — | Belum ada UI baru; mulai fase 1 |

**Tes isolasi adalah tes terpenting repository ini**:
dua user dibuat, user A menulis data (memakai tabel fase 1 begitu ada; di
fase 0 cukup kerangkanya), sesi user B tidak bisa membaca atau menulisnya —
dan mendapat **404, bukan 403**. Setiap fase berikutnya wajib menambahkan
kasusnya sendiri ke tes ini (todo, storage, agent, mail).

---

## 9. Success Criteria

- [ ] `npm run verify` lulus dari clone bersih tanpa warning
- [ ] `docker compose up -d postgres && npm run db:migrate` lalu
      `npm run user -- add …` × 3 → tiga akun hidup
- [ ] `npm run dev` → web :4200, api :3001; `/health` 200
- [ ] Route selain `/health` & `/auth/login` → 401 tanpa cookie, dengan
      envelope §6
- [ ] Login benar → cookie ter-set, `GET /auth/me` mengembalikan user;
      logout → cookie hilang
- [ ] Email salah dan password salah → error identik; percobaan ke-6 dalam
      15 menit → 429
- [ ] Sesi bertahan restart browser; kedaluwarsa 30 hari; cookie yang
      dimodifikasi ditolak
- [ ] `user set-password` mengganti password tanpa menyentuh data lain
- [ ] Error apa pun → envelope §6; stack trace & hash tidak pernah bocor
- [ ] Tes isolasi §8 lulus
- [ ] Terdeploy ke VPS via HTTPS; ketiga akun bisa login dari HP
